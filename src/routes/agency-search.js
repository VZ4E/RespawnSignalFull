const express = require('express');
const axios = require('axios');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/agency-search/scrape
 * Scrape creator handles from an agency website using Perplexity Sonar
 * 
 * Body: { url: string, domain?: string }
 * Returns: { creators: [{ handle, name, platforms, followerCount, verified }], agencyName, agencyDomain }
 */
router.post('/scrape', async (req, res) => {
  const { url, domain } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const perplexityKey = process.env.PERPLEXITY_KEY;
  if (!perplexityKey) {
    return res.status(500).json({ error: 'Perplexity API key not configured' });
  }

  try {
    console.log(`[Agency Scrape] Starting scrape for URL: ${url}`);

    // Normalize the URL
    let normalizedUrl = url.toLowerCase().trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    // Extract domain for context
    let agencyDomain = domain || extractDomain(normalizedUrl);

    // Use Perplexity Sonar to extract creators from the agency page
    const perplexityResponse = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: `You are analyzing an agency's website to find creator/influencer roster information.

Visit and analyze this URL: ${normalizedUrl}

Extract EVERY creator, influencer, talent, or artist listed on their roster page. For each person found, provide:
1. Their creator/username handle (as they appear on social media)
2. Their real name (if available)
3. Which platforms they're on (tiktok, youtube, instagram, twitch, etc.)
4. Approximate follower count if mentioned

Return ONLY a JSON array with NO additional text, formatted exactly like this:
[
  { "handle": "username", "name": "Real Name", "platforms": ["tiktok", "youtube"], "followerCount": 2500000 },
  { "handle": "another_user", "name": "Another Person", "platforms": ["instagram"], "followerCount": 950000 }
]

If you cannot find creator information on this page, return an empty array: []

IMPORTANT: Return ONLY the JSON array, no markdown, no code blocks, no explanation.`
          }
        ],
        temperature: 0.7,
        top_p: 0.9,
        return_citations: false,
        search_domain_filter: [agencyDomain]
      },
      {
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[Agency Scrape] Perplexity response:', perplexityResponse.data);

    let creators = [];
    const content = perplexityResponse.data.choices?.[0]?.message?.content || '';

    // Parse the JSON response
    try {
      // Extract JSON array from the response (in case there's extra text)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        creators = JSON.parse(jsonMatch[0]);
      } else {
        creators = JSON.parse(content);
      }
    } catch (parseErr) {
      console.error('[Agency Scrape] JSON parse error:', parseErr.message);
      console.error('[Agency Scrape] Raw content:', content);
      // Return what we got, even if parsing failed
      creators = [];
    }

    // Validate and normalize creator data
    const validCreators = (creators || [])
      .filter(c => c.handle && typeof c.handle === 'string')
      .map(c => ({
        handle: c.handle.toLowerCase().trim().replace(/^@/, ''),
        name: c.name || c.handle,
        platforms: (c.platforms || []).map(p => p.toLowerCase().trim()),
        followerCount: c.followerCount || c.follower_count || 0,
        verified: false
      }))
      .slice(0, 50); // Limit to 50 creators per scrape

    console.log(`[Agency Scrape] Extracted ${validCreators.length} creators from ${agencyDomain}`);

    res.json({
      success: true,
      agencyName: extractAgencyName(url),
      agencyDomain: agencyDomain,
      creators: validCreators,
      count: validCreators.length
    });
  } catch (err) {
    console.error('[Agency Scrape] Error:', err.message);
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Perplexity API. Please try again in a moment.' });
    }
    res.status(500).json({ error: 'Failed to scrape agency creators', details: err.message });
  }
});

/**
 * POST /api/agency-search/verify
 * Verify creator handles exist on social media platforms
 * 
 * Body: { creators: [{ handle, platforms }] }
 * Returns: { verified: [{ handle, platforms, exists: boolean }] }
 */
router.post('/verify', async (req, res) => {
  const { creators } = req.body;

  if (!Array.isArray(creators)) {
    return res.status(400).json({ error: 'creators must be an array' });
  }

  try {
    // For now, mark all as verified = false until we wire up platform APIs
    // This will be replaced with actual API calls to TikTok, YouTube, Instagram, Twitch
    const verified = creators.map(c => ({
      ...c,
      exists: false,
      verified: false,
      reason: 'Verification pending API integration'
    }));

    res.json({
      verified,
      verified_count: verified.filter(v => v.verified).length,
      total: verified.length
    });
  } catch (err) {
    console.error('[Agency Verify] Error:', err.message);
    res.status(500).json({ error: 'Failed to verify creators' });
  }
});

/**
 * POST /api/agency-search/save
 * Save an agency and its tracked creators
 * 
 * Body: { agencyName, agencyDomain, creators: [{ handle, platforms, followerCount }] }
 * Returns: { agencyId, creatorIds }
 */
router.post('/save', async (req, res) => {
  const { agencyName, agencyDomain, creators } = req.body;

  if (!agencyName || !agencyDomain || !Array.isArray(creators)) {
    return res.status(400).json({ error: 'agencyName, agencyDomain, and creators are required' });
  }

  try {
    // Insert agency
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .insert([
        {
          user_id: req.user.id,
          name: agencyName.trim(),
          domain: agencyDomain.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (agencyError) throw agencyError;

    // Insert creators (linked to agency)
    const creatorRows = creators.map(c => ({
      agency_id: agency.id,
      creator_handle: c.handle.trim(),
      platforms: c.platforms || [],
      follower_count: c.followerCount || 0,
      tracked: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { data: agencyCreators, error: creatorsError } = await supabase
      .from('agency_creators')
      .insert(creatorRows)
      .select();

    if (creatorsError) throw creatorsError;

    console.log(`[Agency Save] Saved agency "${agencyName}" with ${agencyCreators.length} creators`);

    res.status(201).json({
      agencyId: agency.id,
      agencyName: agency.name,
      agencyDomain: agency.domain,
      creatorCount: agencyCreators.length,
      creators: agencyCreators.map(c => ({
        id: c.id,
        handle: c.creator_handle,
        platforms: c.platforms,
        followerCount: c.follower_count
      }))
    });
  } catch (err) {
    console.error('[Agency Save] Error:', err.message);
    res.status(500).json({ error: 'Failed to save agency', details: err.message });
  }
});

/**
 * GET /api/agency-search/list
 * List all agencies and their creators for the authenticated user
 */
router.get('/list', async (req, res) => {
  try {
    const { data: agencies, error } = await supabase
      .from('agencies')
      .select(`
        id,
        name,
        domain,
        created_at,
        updated_at,
        agency_creators(
          id,
          creator_handle,
          platforms,
          follower_count,
          tracked,
          created_at
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      agencies: agencies.map(a => ({
        id: a.id,
        name: a.name,
        domain: a.domain,
        creatorCount: a.agency_creators?.length || 0,
        trackedCount: a.agency_creators?.filter(c => c.tracked).length || 0,
        creators: a.agency_creators || [],
        createdAt: a.created_at,
        updatedAt: a.updated_at
      }))
    });
  } catch (err) {
    console.error('[Agency List] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch agencies' });
  }
});

/**
 * DELETE /api/agency-search/:agencyId
 * Delete an agency and all associated creators
 */
router.delete('/:agencyId', async (req, res) => {
  const { agencyId } = req.params;

  try {
    // Delete all creators for this agency first
    await supabase
      .from('agency_creators')
      .delete()
      .eq('agency_id', agencyId);

    // Then delete the agency
    const { error } = await supabase
      .from('agencies')
      .delete()
      .eq('id', agencyId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    console.log(`[Agency Delete] Deleted agency ${agencyId}`);
    res.json({ success: true, message: 'Agency deleted' });
  } catch (err) {
    console.error('[Agency Delete] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete agency' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extract domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (_) {
    return url;
  }
}

/**
 * Extract agency name from URL
 */
function extractAgencyName(url) {
  try {
    const domain = extractDomain(url);
    return domain
      .split('.')[0]
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  } catch (_) {
    return url;
  }
}

module.exports = router;
