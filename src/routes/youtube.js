// POST /api/youtube/scan
// Authenticated — requires valid Supabase session token
// Body: { channelInput: string, scanDepth: 10 | 20 | 30 }

const express = require('express');
const router = express.Router();
const { fetchChannelData, VALID_SCAN_DEPTHS, DEFAULT_SCAN_DEPTH } = require('../services/youtubeService');
const { runYoutubeScan } = require('../services/youtubeScanner');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/authMiddleware');

// POST /api/youtube/scan
router.post('/scan', authMiddleware, async (req, res) => {
  const { channelInput, scanDepth = 10 } = req.body;

  if (!channelInput || typeof channelInput !== 'string' || !channelInput.trim()) {
    return res.status(400).json({ error: 'channelInput is required' });
  }

  const { dbUser, planConfig } = req;

  // Block if no plan
  if (!dbUser.plan || dbUser.plan === 'none') {
    return res.status(403).json({ error: 'No active plan. Please subscribe to start scanning.' });
  }

  // Check credits (YouTube scans are ~1 credit per video analyzed)
  if (dbUser.credits_remaining <= 0) {
    return res.status(402).json({ error: 'No credits remaining.' });
  }

  // Enforce scan depth by plan
  const safeDepth = Math.min(parseInt(scanDepth) || 10, planConfig.maxRange);

  // Check cache: same channel + depth within last 7 days
  const { data: existing } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', dbUser.id)
    .eq('platform', 'youtube')
    .eq('channel_input', channelInput.trim())
    .eq('scan_depth', safeDepth)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return res.json({
      cached: true,
      cachedAt: existing.created_at,
      ...existing,
    });
  }

  let scanResult;
  let creditsUsed = 0;

  try {
    // 1. Fetch channel data + videos
    const channelData = await fetchChannelData(channelInput.trim(), safeDepth);

    // 2. Run brand detection
    scanResult = await runYoutubeScan(channelData);

    // Calculate credits (1 per video analyzed)
    creditsUsed = Math.min(scanResult.videosAnalyzed, dbUser.credits_remaining);

  } catch (err) {
    console.error('[youtube route] Scan error:', err.message);

    if (err.message.includes('No YouTube channel found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Could not parse YouTube channel')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('YouTube API error')) {
      return res.status(502).json({ error: 'YouTube API unavailable. Try again shortly.' });
    }

    return res.status(500).json({ error: 'Scan failed. Please try again.' });
  }

  try {
    // 3. Deduct credits (wrapped in try/finally for earlier robustness)
    if (creditsUsed > 0) {
      await supabase
        .from('users')
        .update({ credits_remaining: dbUser.credits_remaining - creditsUsed })
        .eq('id', dbUser.id);
    }
  } catch (creditErr) {
    console.error('[youtube route] Credit deduction failed:', creditErr);
    // Log but don't fail — scan completed, credit issue is separate
  }

  // 4. Persist scan to history
  const { data: scanRecord, error: insertError } = await supabase
    .from('scans')
    .insert({
      user_id: dbUser.id,
      platform: 'youtube',
      username: scanResult.channel.title,
      channel_name: scanResult.channel.title,
      channel_handle: scanResult.channel.handle,
      channel_input: channelInput.trim(),
      channel_thumbnail: scanResult.channel.thumbnailUrl,
      subscriber_count: scanResult.channel.subscriberCount,
      unique_brand_count: scanResult.uniqueBrandCount,
      total_deals_found: scanResult.totalDealsFound,
      videos_analyzed: scanResult.videosAnalyzed,
      videos_with_deals: scanResult.videosWithDeals,
      scan_depth: safeDepth,
      summary: scanResult.summary,
      deals: scanResult.brandsFound,
      unique_brands: scanResult.uniqueBrands,
      videos: scanResult.videos,
      credits_used: creditsUsed,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[youtube route] Scan insert failed:', insertError);
  }

  // 5. Respond with results
  return res.json({
    success: true,
    scanId: scanRecord?.id || null,
    platform: 'youtube',
    cached: false,
    channel: scanResult.channel,
    deals: scanResult.brandsFound,
    videos: scanResult.videos,
    uniqueBrands: scanResult.uniqueBrands,
    totalDealsFound: scanResult.totalDealsFound,
    uniqueBrandCount: scanResult.uniqueBrandCount,
    videosAnalyzed: scanResult.videosAnalyzed,
    videosWithDeals: scanResult.videosWithDeals,
    summary: scanResult.summary,
    creditsUsed,
  });
});

module.exports = router;
