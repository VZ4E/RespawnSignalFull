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
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting creator and influencer information from agency websites. Extract all roster information and return as valid JSON.'
          },
          {
            role: 'user',
            content: `Analyze this agency website THOROUGHLY and extract EVERY SINGLE creator/influencer from their complete roster:

URL: ${normalizedUrl}

IMPORTANT: Extract ALL creators listed, not just a sample. Check every page, every section, every roster list.

For each creator, provide:
- handle: Username/handle (without @)
- name: Real name if available
- platforms: Platforms they're on [tiktok, youtube, instagram, twitch, etc]
- followerCount: Follower count if mentioned
- niche: Content niche/category (e.g., "beauty", "gaming", "fitness", "comedy", "fashion", etc)

Return ONLY valid JSON array, no markdown, no code blocks:
[
  {"handle":"user1","name":"Name","platforms":["tiktok","instagram"],"followerCount":2000000,"niche":"beauty"},
  {"handle":"user2","name":"Name","platforms":["youtube"],"followerCount":500000,"niche":"gaming"},
  {"handle":"user3","name":"Name","platforms":["twitch","youtube"],"followerCount":1500000,"niche":"gaming"}
]

If no creators found, return: []

CRITICAL: Return COMPLETE roster, not truncated results.`
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 4000
      },
      {
        headers: {
          Authorization: `Bearer ${perplexityKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
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
        niche: (c.niche || '').toLowerCase().trim() || 'general',
        verified: false
      }))
      .slice(0, 200); // Increased from 50 to 200 creators per scrape

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
    console.error('[Agency Scrape] Error details:', {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      headers: err.response?.headers
    });
    
    if (err.response?.status === 429) {
      return res.status(429).json({ error: 'Rate limited by Perplexity API. Please try again in a moment.' });
    }
    
    if (err.response?.status === 401) {
      return res.status(401).json({ error: 'Perplexity API key is invalid or expired' });
    }
    
    res.status(500).json({ 
      error: 'Failed to scrape agency creators', 
      details: err.message,
      perplexityError: err.response?.data?.error
    });
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
 * Save an agency and its tracked creators to Supabase
 * 
 * Body: { agencyName, agencyDomain, creators: [{ handle, platforms, followerCount }] }
 * Returns: { agencyId, creatorIds }
 */
router.post('/save', async (req, res) => {
  const { agencyName, agencyDomain, creators } = req.body;
  const userId = req.user.id;

  if (!agencyName || !agencyDomain || !Array.isArray(creators)) {
    return res.status(400).json({ error: 'agencyName, agencyDomain, and creators are required' });
  }

  try {
    console.log(`[Agency Save] Saving agency "${agencyName}" for user ${userId}`);

    // Insert agency
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .insert([
        {
          user_id: userId,
          name: agencyName.trim(),
          domain: agencyDomain.trim()
        }
      ])
      .select()
      .single();

    if (agencyError) {
      console.error('[Agency Save] Agency insert error:', agencyError);
      throw agencyError;
    }

    console.log(`[Agency Save] Created agency with ID: ${agency.id}`);

    // Insert creators (linked to agency)
    const creatorRows = creators.map(c => ({
      agency_id: agency.id,
      user_id: userId,
      creator_handle: c.handle.trim().toLowerCase(),
      platform: c.platforms && c.platforms.length > 0 ? c.platforms[0] : 'tiktok',
      follower_count: c.followerCount || 0,
      status: 'active'
    }));

    const { data: agencyCreators, error: creatorsError } = await supabase
      .from('agency_creators')
      .insert(creatorRows)
      .select();

    if (creatorsError) {
      console.error('[Agency Save] Creators insert error:', creatorsError);
      // Delete the agency if creators insert fails
      await supabase.from('agencies').delete().eq('id', agency.id);
      throw creatorsError;
    }

    console.log(`[Agency Save] Saved agency "${agencyName}" with ${agencyCreators.length} creators`);

    res.status(201).json({
      success: true,
      agencyId: agency.id,
      agencyName: agency.name,
      agencyDomain: agency.domain,
      creatorCount: agencyCreators.length,
      creators: agencyCreators.map(c => ({
        id: c.id,
        handle: c.creator_handle,
        platform: c.platform,
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
  const userId = req.user.id;

  try {
    console.log(`[Agency List] Fetching agencies for user ${userId}`);

    const { data: agencies, error } = await supabase
      .from('agencies')
      .select(`
        id,
        name,
        domain,
        website_url,
        industry,
        created_at,
        updated_at,
        last_scan_at,
        agency_creators(
          id,
          creator_handle,
          platform,
          follower_count,
          engagement_rate,
          status,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Agency List] Query error:', error);
      throw error;
    }

    console.log(`[Agency List] Found ${agencies?.length || 0} agencies`);

    res.json({
      success: true,
      count: agencies?.length || 0,
      agencies: (agencies || []).map(a => ({
        id: a.id,
        name: a.name,
        domain: a.domain,
        website_url: a.website_url,
        industry: a.industry,
        creatorCount: a.agency_creators?.length || 0,
        creators: (a.agency_creators || []).map(c => ({
          id: c.id,
          handle: c.creator_handle,
          platform: c.platform,
          followerCount: c.follower_count,
          engagementRate: c.engagement_rate,
          status: c.status,
          createdAt: c.created_at
        })),
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        lastScanAt: a.last_scan_at
      }))
    });
  } catch (err) {
    console.error('[Agency List] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch agencies', details: err.message });
  }
});

/**
 * POST /api/agency-search/add-to-watchlist
 * Add a single creator to user's watchlist
 * 
 * Body: { handle, name, platforms, followerCount, niche }
 * Returns: { success, creatorId }
 */
router.post('/add-to-watchlist', async (req, res) => {
  const userId = req.user.id;
  const { handle, name, platforms, followerCount, niche } = req.body;

  if (!handle) {
    return res.status(400).json({ error: 'handle is required' });
  }

  try {
    console.log(`[Watchlist] Adding creator ${handle} to user ${userId} watchlist`);

    // Create or get a "Watchlist" agency for the user
    let { data: watchlistAgency, error: checkErr } = await supabase
      .from('agencies')
      .select('id')
      .eq('user_id', userId)
      .eq('name', 'My Watchlist')
      .single();

    if (!watchlistAgency) {
      // Create watchlist agency if it doesn't exist
      const { data: newAgency, error: createErr } = await supabase
        .from('agencies')
        .insert({
          user_id: userId,
          name: 'My Watchlist',
          domain: 'watchlist.local',
          website_url: 'internal://watchlist',
          industry: 'mixed'
        })
        .select('id')
        .single();

      if (createErr) throw createErr;
      watchlistAgency = newAgency;
    }

    // Check if creator already exists in watchlist
    const { data: existing } = await supabase
      .from('agency_creators')
      .select('id')
      .eq('agency_id', watchlistAgency.id)
      .eq('creator_handle', handle.toLowerCase())
      .single();

    if (existing) {
      return res.json({ success: true, message: 'Creator already in watchlist', creatorId: existing.id });
    }

    // Add creator to watchlist
    const { data: creator, error: insertErr } = await supabase
      .from('agency_creators')
      .insert({
        agency_id: watchlistAgency.id,
        user_id: userId,
        creator_handle: handle.toLowerCase(),
        platform: (platforms && platforms[0]) || 'unknown',
        platform_url: `https://www.${platforms?.[0] || 'unknown'}.com/${handle}`,
        follower_count: followerCount || 0,
        engagement_rate: 0,
        status: 'active',
        niche: niche || 'general'
      })
      .select('id')
      .single();

    if (insertErr) throw insertErr;

    console.log(`[Watchlist] Added creator ${handle} to watchlist`);
    res.json({ success: true, creatorId: creator.id });
  } catch (err) {
    console.error('[Watchlist] Error:', err.message);
    res.status(500).json({ error: 'Failed to add to watchlist', details: err.message });
  }
});

/**
 * DELETE /api/agency-search/:agencyId
 * Delete an agency and all associated creators from Supabase
 */
router.delete('/:agencyId', async (req, res) => {
  const { agencyId } = req.params;
  const userId = req.user.id;

  try {
    console.log(`[Agency Delete] Deleting agency ${agencyId} for user ${userId}`);

    // Verify ownership before deleting
    const { data: agency, error: checkErr } = await supabase
      .from('agencies')
      .select('id, user_id')
      .eq('id', agencyId)
      .single();

    if (checkErr || !agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    if (agency.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this agency' });
    }

    // Delete all creators for this agency (cascade will handle this, but explicit delete is safer)
    const { error: creatorsError } = await supabase
      .from('agency_creators')
      .delete()
      .eq('agency_id', agencyId);

    if (creatorsError) {
      console.error('[Agency Delete] Creator deletion error:', creatorsError);
      throw creatorsError;
    }

    // Delete the agency
    const { error: agencyError } = await supabase
      .from('agencies')
      .delete()
      .eq('id', agencyId)
      .eq('user_id', userId);

    if (agencyError) {
      console.error('[Agency Delete] Agency deletion error:', agencyError);
      throw agencyError;
    }

    console.log(`[Agency Delete] Successfully deleted agency ${agencyId}`);
    res.json({ success: true, message: 'Agency deleted successfully' });
  } catch (err) {
    console.error('[Agency Delete] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete agency', details: err.message });
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
