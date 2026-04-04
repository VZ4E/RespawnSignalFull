const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { extractNicheHintFromUrl } = require('../utils/nicheExtractor');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clean handle by extracting valid segment from URL or path
 * Safely handles malformed URLs that would crash URL() constructor
 */
function cleanHandle(handle) {
  if (!handle) return handle;
  
  if (handle.startsWith('http://') || handle.startsWith('https://')) {
    try {
      const url = new URL(handle);
      const segments = url.pathname.split('/').filter(Boolean);
      handle = segments[segments.length - 1] || handle;
    } catch (e) {
      // If URL parsing fails, fall back to string splitting
      console.warn(`[cleanHandle] Failed to parse URL "${handle}":`, e.message);
      handle = handle.split('/').filter(Boolean).pop() || handle;
    }
  }
  
  if (handle.startsWith('/')) {
    handle = handle.split('/').filter(Boolean).pop() || handle;
  }
  
  // Remove @ if present, return without @ (caller can add if needed)
  if (handle.startsWith('@')) {
    handle = handle.substring(1);
  }
  
  return handle;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIKTOK PROFILE FETCH
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if an email is a business/professional email (not a common personal domain)
 */
function isBusinessEmail(email) {
  const commonPersonalDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'protonmail.com', 'mail.com', 'yandex.com', 'qq.com', 'icloud.com',
    'msn.com', 'live.com', 'gmx.com', 'mail.ru', 'inbox.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  return domain && !commonPersonalDomains.includes(domain);
}

/**
 * Extract social media handles from URLs found in Firecrawl search results
 */
function extractSocialHandlesFromUrls(urls) {
  const handles = {};
  
  urls.forEach(url => {
    const urlLower = url.toLowerCase();
    
    // Instagram: extract username from instagram.com/username
    if (urlLower.includes('instagram.com/')) {
      const match = url.match(/instagram\.com\/([a-zA-Z0-9._-]+)/i);
      if (match && match[1]) {
        handles.instagram = match[1];
      }
    }
    
    // YouTube: extract channel ID or custom URL
    if (urlLower.includes('youtube.com/')) {
      const channelMatch = url.match(/youtube\.com\/(@[a-zA-Z0-9_-]+|channel\/[a-zA-Z0-9_-]+)/i);
      if (channelMatch && channelMatch[1]) {
        handles.youtube = { channelId: channelMatch[1], title: 'YouTube' };
      }
    }
    
    // Twitter/X: extract username from twitter.com or x.com
    if (urlLower.includes('twitter.com/') || urlLower.includes('x.com/')) {
      const match = url.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i);
      if (match && match[1]) {
        handles.twitter = match[1];
      }
    }
    
    // Linktree: just note it exists
    if (urlLower.includes('linktree.com/')) {
      const match = url.match(/linktree\.com\/([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        handles.linktree = match[1];
      }
    }
  });
  
  return handles;
}

/**
 * Fetch TikTok profile data using the RapidAPI endpoint
 * Returns: { displayName, bio, bioLinks, emails, socialHandles: { instagram, twitter, youtube } }
 */
async function fetchTikTokProfile(username) {
  // Normalize username to lowercase for TikTok API
  const normalizedUsername = username.toLowerCase().trim();
  console.log(`[TikTok Profile] Fetching profile for @${normalizedUsername}`);
  
  try {
    const resp = await fetch(
      `https://tiktok-scraper7.p.rapidapi.com/user/info?unique_id=${encodeURIComponent(normalizedUsername)}`,
      {
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY,
          'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        },
      }
    );
    
    const data = await resp.json();
    console.log(`[TikTok Profile] Raw response for @${normalizedUsername}:`, JSON.stringify(data).substring(0, 800));
    
    if (!resp.ok) {
      throw new Error(`API error: ${resp.status}`);
    }
    
    // Extract user info from various possible response structures
    const userInfo = data?.data?.user || data?.data || data?.user || data;
    
    if (!userInfo) {
      console.warn(`[TikTok Profile] No user info found in response for @${normalizedUsername}`);
      return null;
    }
    
    // Debug: Log exact field keys and social handles
    console.log(`[TikTok Profile] userData keys:`, Object.keys(userInfo || {}));
    console.log(`[TikTok Profile] Social handles - Instagram:`, userInfo?.ins_id, `Twitter:`, userInfo?.twitter_id, `YouTube:`, userInfo?.youtube_channel_id);
    
    // Extract profile data
    const displayName = userInfo.nickname || userInfo.user?.nickname || userInfo.uniqueId || normalizedUsername;
    const bio = userInfo.signature || userInfo.user?.signature || '';
    
    // Extract linked social media accounts
    const socialHandles = {};
    if (userInfo?.ins_id) socialHandles.instagram = userInfo.ins_id;
    if (userInfo?.twitter_id) socialHandles.twitter = userInfo.twitter_id;
    if (userInfo?.youtube_channel_id) {
      socialHandles.youtube = {
        channelId: userInfo.youtube_channel_id,
        title: userInfo.youtube_channel_title || 'YouTube'
      };
    }
    
    console.log(`[TikTok Profile] Final social handles for @${normalizedUsername}:`, socialHandles);
    
    // Extract links and emails from bio (raw data only)
    const bioLinks = [];
    const emails = [];
    
    if (bio) {
      // Extract URLs from bio: https/http, www., or bare domains (with optional path)
      // Pattern: (https?://... | www.... | bare.domain.com/path)
      const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
      const urlMatches = bio.match(urlPattern);
      if (urlMatches) {
        // Filter duplicates and add https:// to bare domains
        urlMatches.forEach(url => {
          if (!bioLinks.includes(url)) {
            // If URL doesn't start with http:// or https://, add https://
            const normalizedUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;
            bioLinks.push(normalizedUrl);
          }
        });
      }
      
      // Extract emails from bio using provided regex
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const emailMatches = bio.match(emailPattern);
      if (emailMatches) {
        emails.push(...emailMatches.filter(email => !emails.includes(email)));
      }
    }
    
    return {
      displayName,
      bio,
      bioLinks,
      emails,
      socialHandles
    };
  } catch (err) {
    console.error(`[TikTok Profile] Error fetching profile for @${username}:`, err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENRICHMENT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Enrich a creator with social media profiles and niche using Perplexity
 * @param {Object} creator - Creator object
 * @param {string} scrapePageUrl - The original URL that was scraped (used to extract niche hint)
 */
async function enrichCreator(creator, scrapePageUrl) {
  // Extract niche hint from the scrape URL (before try/catch so catch block can access it)
  const nicheResult = extractNicheHintFromUrl(scrapePageUrl) || { hint: null, isDirectMatch: false };
  const { hint: nicheHint, isDirectMatch } = nicheResult;
  console.log(`[Enrichment] Creator: ${creator.name || creator.handle} | URL: ${scrapePageUrl} | nicheHint: ${nicheHint} | isDirectMatch: ${isDirectMatch}`);

  try {
    
    // If niche hint is a direct match, we only need to find social handles
    const nicheContext = nicheHint ? `This creator was found on a ${nicheHint} agency page. Use this as strong context when determining their niche category.` : '';
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{
          role: 'user',
          content: `Find the social media profiles for the content creator or influencer named "${creator.name || creator.handle}". ${nicheContext} Return ONLY a JSON object with these fields: tiktok (handle without @), youtube (channel name or handle), instagram (handle without @), twitter (handle without @), followerCount (their largest platform follower count as a number), mainPlatform (their primary platform: TikTok/YouTube/Instagram/Twitch)${isDirectMatch ? '' : ', niche (one of: Fortnite/Battle Royale, FPS/Competitive, Minecraft/Sandbox, Roblox/Family Gaming, Fitness/Gaming, Lifestyle/IRL, RPG/Story Games, Strategy/Esports, Sports Games, Variety Gaming, Tech/Gaming, Entertainment, Influencer, Athlete, Uncategorized)'}. Return null for any field you cannot find. Return ONLY the JSON object, no other text.`
        }],
        max_tokens: 200
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const enriched = JSON.parse(clean);

    // Build platforms array from found handles
    const platforms = [];
    if (enriched.tiktok) platforms.push('TikTok');
    if (enriched.youtube) platforms.push('YouTube');
    if (enriched.instagram) platforms.push('Instagram');
    if (enriched.twitter) platforms.push('Twitter');

    // Use direct niche match if available, otherwise use Perplexity response
    const finalNiche = isDirectMatch ? nicheHint : (enriched.niche || 'Uncategorized');
    
    console.log(`[Enrichment] Creator: ${creator.name || creator.handle} | nicheHint: ${nicheHint} | isDirectMatch: ${isDirectMatch} | finalNiche: ${finalNiche} | perplexityNiche: ${enriched.niche}`);
    
    if (isDirectMatch && nicheHint) {
      console.log(`[Enrichment] ✓ Using direct niche hint "${nicheHint}" for ${creator.name || creator.handle} (skipped Perplexity niche classification)`);
    }

    return {
      ...creator,
      handle: enriched.tiktok || enriched.instagram || enriched.youtube || creator.handle,
      platforms,
      followerCount: enriched.followerCount || creator.followerCount,
      niche: finalNiche,
      socials: {
        tiktok: enriched.tiktok || null,
        youtube: enriched.youtube || null,
        instagram: enriched.instagram || null,
        twitter: enriched.twitter || null
      },
      mainPlatform: enriched.mainPlatform || null
    };
  } catch (e) {
    const fallbackNiche = isDirectMatch ? nicheHint : 'Uncategorized';
    console.warn(`[Enrichment] Error enriching creator ${creator.name || creator.handle}: ${e.message} | Using fallback niche: ${fallbackNiche} (isDirectMatch: ${isDirectMatch})`);
    return { 
      ...creator, 
      niche: fallbackNiche, 
      platforms: creator.platforms || [], 
      socials: {},
      mainPlatform: null
    };
  }
}

/**
 * POST /api/agency-search/scrape
 * Scrape creator roster from an agency website using Firecrawl
 * 
 * Body: { url: string }
 * Returns: { success: true, creators: [...], count: number }
 */
router.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) {
    return res.status(500).json({ error: 'Firecrawl API key not configured' });
  }

  try {
    console.log(`[Agency Scrape] Starting Firecrawl crawl for URL: ${url}`);

    // Normalize the URL
    let normalizedUrl = url.toLowerCase().trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    console.log(`[Agency Scrape] Initiating site crawl for: ${normalizedUrl}`);

    // Step 1: Initiate crawl with extraction on all pages
    const crawlResponse = await fetch('https://api.firecrawl.dev/v1/crawl', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: normalizedUrl,
        limit: 20,
        allowExternalLinks: false,
        scrapeOptions: {
          formats: ['extract'],
          extract: {
            prompt: 'Extract all talent, creator, and influencer roster entries from this page. For each person return their social media handle, full name, platforms they are on, follower count if available, and a short description. Only return people who are talent/creators/influencers represented by this agency.',
            schema: {
              type: 'object',
              properties: {
                creators: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      handle: { type: 'string' },
                      name: { type: 'string' },
                      platforms: { type: 'array', items: { type: 'string' } },
                      followerCount: { type: 'number' },
                      description: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      })
    });

    console.log(`[Agency Scrape] Crawl initiation response status: ${crawlResponse.status}`);

    if (!crawlResponse.ok) {
      const errorText = await crawlResponse.text();
      console.error(`[Agency Scrape] Firecrawl crawl error (${crawlResponse.status}):`, errorText);
      return res.status(crawlResponse.status).json({ 
        error: `Firecrawl crawl error (${crawlResponse.status})`,
        details: errorText
      });
    }

    const crawlData = await crawlResponse.json();
    console.log(`[Agency Scrape] Crawl initiated with ID:`, crawlData.id);

    // Step 2: Poll for crawl completion with partial results fallback
    if (crawlData.success && crawlData.id) {
      let completed = false;
      let attempts = 0;
      let allCreators = [];
      let creatorsFoundAttempt = null;

      console.log(`[Agency Scrape] Polling for crawl completion (up to 30 attempts, 3s interval)...`);

      while (!completed && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;

        // Fetch with 60 second timeout to allow Firecrawl time to complete scrape
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        
        let statusData;
        try {
          const statusResponse = await fetch(`https://api.firecrawl.dev/v1/crawl/${crawlData.id}`, {
            headers: { 'Authorization': `Bearer ${firecrawlKey}` },
            signal: controller.signal
          });
          statusData = await statusResponse.json();
        } catch (e) {
          clearTimeout(timeout);
          console.error(`[Agency Scrape] Poll attempt ${attempts}: Fetch timeout or error:`, e.message);
          // If we already have creators, break out and use them
          if (allCreators.length > 0) {
            console.log(`[Agency Scrape] Using partial results (${allCreators.length} creators found so far)`);
            break;
          }
          throw e;
        }
        clearTimeout(timeout);

        console.log(`[Agency Scrape] Poll attempt ${attempts}: status=${statusData.status}, pages=${(statusData.data || []).length}`);

        if (statusData.data && statusData.data.length > 0) {
          // Extract creators from all crawled pages
          for (const page of statusData.data) {
            const pageCreators = page.extract?.creators || [];
            console.log(`[Agency Scrape] Found ${pageCreators.length} creators on page: ${page.url}`);
            allCreators = allCreators.concat(pageCreators);
          }
          
          // Track when creators were first found
          if (creatorsFoundAttempt === null) {
            creatorsFoundAttempt = attempts;
          }
        }

        if (statusData.status === 'completed') {
          completed = true;
          console.log(`[Agency Scrape] Crawl completed after ${attempts} polls`);
        } else if (allCreators.length > 0 && attempts >= creatorsFoundAttempt + 15) {
          // Partial results timeout: if creators found and we've waited 45+ seconds since first result, use partial results
          console.log(`[Agency Scrape] Crawl still in progress after ${attempts} polls (${(attempts - creatorsFoundAttempt) * 3}s since first results). Using partial results with ${allCreators.length} creators.`);
          completed = true;
        }
      }

      // Debug log: show raw creators before any cleaning/deduplication
      console.log(`[Agency Scrape] Raw creators before cleaning: ${allCreators.length} total`);
      if (allCreators.length > 0) {
        console.log(`[Agency Scrape] First creator raw data:`, JSON.stringify(allCreators[0]));
      }

      // Deduplicate by handle
      const seen = new Set();
      const uniqueCreators = allCreators.filter(c => {
        if (!c.handle || seen.has(c.handle)) return false;
        seen.add(c.handle);
        return true;
      });

      // Validate, normalize, and clean creator data
      let validCreators = uniqueCreators
        .map(c => {
          let handle = c.handle.toLowerCase().trim().replace(/^@/, '');
          
          // Fix 1: Strip URL handles (safely handles malformed URLs)
          handle = cleanHandle(handle);
          
          return {
            handle: handle,
            name: (c.name || c.handle).trim(),
            platforms: (c.platforms || []).map(p => p.toLowerCase().trim()),
            followerCount: c.followerCount || c.follower_count || 0,
            description: c.description || '',
            verified: false,
            // Track social count for dedup priority
            socialCount: [c.socials?.tiktok, c.socials?.youtube, c.socials?.instagram, c.socials?.twitter].filter(Boolean).length
          };
        })
        // Fix 2: Filter garbage entries
        .filter(c => {
          // Skip if handle contains dulcedo.com
          if (c.handle.includes('dulcedo.com')) return false;
          // Skip if name is generic placeholder
          if (c.name === 'John Doe' || c.name === 'Jane Smith') return false;
          // Skip if handle is query string
          if (c.handle.startsWith('?') || c.handle.includes('?view=')) return false;
          // Skip if name contains Dulcedo (navigation item)
          if (c.name.toLowerCase().includes('dulcedo')) return false;
          return true;
        })
        // Fix 3: Deduplicate by name (case-insensitive), keeping entry with more socials
        .reduce((acc, creator) => {
          const existingIdx = acc.findIndex(existing => 
            existing.name.toLowerCase() === creator.name.toLowerCase()
          );
          
          if (existingIdx === -1) {
            // New creator
            acc.push(creator);
          } else {
            // Duplicate name found - keep the one with more social data
            const existing = acc[existingIdx];
            const existingSocialCount = existing.socialCount || 0;
            const newSocialCount = creator.socialCount || 0;
            
            if (newSocialCount > existingSocialCount) {
              console.log(`[Agency Scrape] Dedup by name: replacing "${existing.handle}" with "${creator.handle}" (${newSocialCount} socials vs ${existingSocialCount})`);
              acc[existingIdx] = creator;
            } else {
              console.log(`[Agency Scrape] Dedup by name: keeping "${existing.handle}" over "${creator.handle}" (${existingSocialCount} socials vs ${newSocialCount})`);
            }
          }
          return acc;
        }, [])
        .slice(0, 500); // Limit to 500 creators max

      console.log(`[Agency Scrape] Total unique creators extracted: ${validCreators.length}`);
      console.log(`[Agency Scrape] Starting Perplexity enrichment for ${validCreators.length} creators (batch size: 5)...`);

      // Enrich in batches of 5 to avoid rate limiting
      const enriched = [];
      for (let i = 0; i < validCreators.length; i += 5) {
        const batch = validCreators.slice(i, i + 5);
        console.log(`[Agency Scrape] Enriching batch ${Math.floor(i / 5) + 1}/${Math.ceil(validCreators.length / 5)}`);
        const results = await Promise.all(batch.map(creator => 
          enrichCreator(creator, normalizedUrl)
        ));
        enriched.push(...results);
      }

      console.log(`[Agency Scrape] Enrichment complete. Returning ${enriched.length} enriched creators.`);

      // Remove internal fields before sending to frontend
      const cleanedCreators = enriched.map(c => {
        const cleaned = { ...c };
        delete cleaned.socialCount;
        return cleaned;
      });

      // Extract the top-level niche (should be same for all creators from same page)
      const finalNiche = cleanedCreators.length > 0 ? cleanedCreators[0].niche : null;

      res.json({
        success: true,
        finalNiche: finalNiche,
        creators: cleanedCreators,
        count: cleanedCreators.length
      });
    } else {
      throw new Error('Crawl initiation failed: no crawl ID received');
    }
  } catch (err) {
    console.error('[Agency Scrape] ============ FIRECRAWL ERROR START ============');
    console.error('[Agency Scrape] Error message:', err.message);
    console.error('[Agency Scrape] Error name:', err.name);
    console.error('[Agency Scrape] Error code:', err.code);
    console.error('[Agency Scrape] Error status:', err.status);
    console.error('[Agency Scrape] Error statusCode:', err.statusCode);
    console.error('[Agency Scrape] Full error object:', JSON.stringify(err, null, 2));
    
    if (err.response) {
      console.error('[Agency Scrape] Response status:', err.response.status);
      console.error('[Agency Scrape] Response statusText:', err.response.statusText);
      console.error('[Agency Scrape] Response headers:', JSON.stringify(err.response.headers, null, 2));
      console.error('[Agency Scrape] Response data:', JSON.stringify(err.response.data, null, 2));
    }
    
    if (err.config) {
      console.error('[Agency Scrape] Request URL:', err.config.url);
      console.error('[Agency Scrape] Request method:', err.config.method);
      console.error('[Agency Scrape] Request headers:', JSON.stringify(err.config.headers, null, 2));
    }
    
    console.error('[Agency Scrape] Stack trace:', err.stack);
    console.error('[Agency Scrape] ============ FIRECRAWL ERROR END ============');
    
    res.status(500).json({ 
      error: 'Failed to scrape agency creators', 
      details: err.message,
      errorName: err.name,
      errorCode: err.code
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
        status: 'active'
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

/**
 * POST /api/agency-search/lookup
 * Look up a creator by TikTok handle using the RapidAPI endpoint
 * 
 * Body: { handle: string }
 * Returns: { creator: { displayName, bio, followers, following, bioLinks, emails, agencyMention }, scanHistory: [...] }
 */
router.post('/lookup', async (req, res) => {
  const { handle } = req.body;
  const userId = req.user.id;

  if (!handle || typeof handle !== 'string') {
    return res.status(400).json({ error: 'handle is required' });
  }

  try {
    const cleanedHandle = cleanHandle(handle);
    // Normalize handle to lowercase for TikTok API (case-insensitive)
    const normalizedHandle = cleanedHandle.toLowerCase();
    console.log(`[Creator Lookup] Looking up: "${handle}" → cleaned to "${cleanedHandle}" → normalized to "${normalizedHandle}"`);

    // Fetch TikTok profile data using the same API as the scanner
    const profileData = await fetchTikTokProfile(normalizedHandle);

    // Check if we have any data at all
    if (!profileData) {
      return res.status(404).json({ error: 'Creator not found', details: 'Could not fetch profile data' });
    }

    if (!profileData.displayName && !profileData.bio && !profileData.followers) {
      return res.status(404).json({ error: 'Creator not found', details: 'Profile data is empty' });
    }

    // Query scan history from the scans table
    console.log(`[Creator Lookup] Querying scans for user_id=${userId}, username ILIKE '%${normalizedHandle}%'`);
    
    const { data: scanHistory, error: scanError } = await supabase
      .from('scans')
      .select('id, username, range, video_count, credits_used, deals, created_at')
      .eq('user_id', userId)
      .ilike('username', `%${normalizedHandle}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`[Creator Lookup] Raw scan query result count: ${scanHistory?.length || 0}`);
    if (scanHistory?.length > 0) {
      console.log(`[Creator Lookup] First scan result username: "${scanHistory[0].username}"`);
    }
    
    if (scanError) {
      console.warn(`[Creator Lookup] Error fetching scan history: ${scanError.message}`);
    }

    // Parse scan results to extract deal counts
    const formattedScanHistory = (scanHistory || []).map(scan => {
      let dealCount = 0;
      if (scan.deals && Array.isArray(scan.deals)) {
        dealCount = scan.deals.length;
      }
      return {
        handle: scan.username,
        date: scan.created_at,
        dealCount: dealCount,
        range: scan.range,
        videoCount: scan.video_count,
        creditsUsed: scan.credits_used
      };
    });

    console.log(`[Creator Lookup] After formatting: ${formattedScanHistory.length} scans for "${normalizedHandle}"`);

    // SILENT LEAD LOGGING: Check if creator is unrepresented
    const businessEmails = profileData.emails.filter(email => isBusinessEmail(email));
    console.log(`[Lead Logging] @${normalizedHandle}: ${profileData.emails.length} emails found, ${businessEmails.length} business emails`);
    
    if (profileData.emails.length === 0 || businessEmails.length === 0) {
      // No business email found — log as unrepresented creator (silently, no response change)
      const { error: logError } = await supabase
        .from('unrepresented_creators')
        .insert([{
          handle: normalizedHandle,
          platform: 'tiktok',
          name: profileData.displayName,
          followers: profileData.followers,
          bio: profileData.bio,
          emails_found: profileData.emails.length > 0 ? profileData.emails : null,
          looked_up_by: userId
        }]);
      
      if (logError) {
        console.warn(`[Lead Logging] Failed to log unrepresented creator @${normalizedHandle}:`, logError.message);
      } else {
        console.log(`[Lead Logging] Logged unrepresented creator: @${normalizedHandle}`);
      }
    }

    res.json({
      creator: {
        displayName: profileData.displayName || null,
        handle: normalizedHandle,
        bio: profileData.bio || null,
        bioLinks: profileData.bioLinks || [],
        emails: profileData.emails || [],
        socialHandles: profileData.socialHandles || {}
      },
      scanHistory: formattedScanHistory
    });
  } catch (err) {
    console.error('[Creator Lookup] Error:', err.message);
    res.status(500).json({ error: 'Lookup failed', details: err.message });
  }
});

module.exports = router;
