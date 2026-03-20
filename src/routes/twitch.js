const express = require('express');
const router = express.Router();
const { fetchChannelData } = require('../services/twitchService');
const { runTwitchScan } = require('../services/twitchScanner');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

router.post('/scan', authMiddleware, async (req, res) => {
  const { channelInput, scanDepth = 10 } = req.body;

  if (!channelInput || typeof channelInput !== 'string' || !channelInput.trim()) {
    return res.status(400).json({ error: 'channelInput is required' });
  }

  const { dbUser, planConfig } = req;

  if (!dbUser.plan || dbUser.plan === 'none') {
    return res.status(403).json({ error: 'No active plan. Please subscribe to start scanning.' });
  }

  if (dbUser.credits_remaining <= 0) {
    return res.status(402).json({ error: 'No credits remaining.' });
  }

  const safeDepth = Math.min(parseInt(scanDepth) || 10, planConfig.maxRange);

  const { data: existing } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', dbUser.id)
    .eq('platform', 'twitch')
    .eq('channel_input', channelInput.trim())
    .eq('scan_depth', safeDepth)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return res.json({ cached: true, cachedAt: existing.created_at, ...existing });
  }

  let scanResult;
  let creditsUsed = 0;

  try {
    const channelData = await fetchChannelData(channelInput.trim(), safeDepth);
    scanResult = await runTwitchScan(channelData);
    creditsUsed = Math.min(scanResult.vodsAnalyzed, dbUser.credits_remaining);
  } catch (err) {
    console.error('[twitch route] Scan error:', err.message);

    if (err.message.includes('No Twitch channel found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Twitch API error')) {
      return res.status(502).json({ error: 'Twitch API unavailable. Try again shortly.' });
    }

    return res.status(500).json({ error: 'Scan failed. Please try again.' });
  }

  try {
    if (creditsUsed > 0) {
      await supabase
        .from('users')
        .update({ credits_remaining: dbUser.credits_remaining - creditsUsed })
        .eq('id', dbUser.id);
    }
  } catch (creditErr) {
    console.error('[twitch route] Credit deduction failed:', creditErr);
  }

  const { data: scanRecord, error: insertError } = await supabase
    .from('scans')
    .insert({
      user_id: dbUser.id,
      platform: 'twitch',
      username: scanResult.channel.title,
      channel_name: scanResult.channel.title,
      channel_handle: scanResult.channel.handle,
      channel_input: channelInput.trim(),
      channel_thumbnail: scanResult.channel.thumbnailUrl,
      unique_brand_count: scanResult.uniqueBrandCount,
      total_deals_found: scanResult.totalDealsFound,
      videos_analyzed: scanResult.vodsAnalyzed,
      videos_with_deals: scanResult.vodsWithDeals,
      scan_depth: safeDepth,
      summary: scanResult.summary,
      deals: scanResult.brandsFound,
      unique_brands: scanResult.uniqueBrands,
      videos: scanResult.vods,
      credits_used: creditsUsed,
    })
    .select('id')
    .single();

  if (insertError) console.error('[twitch route] Scan insert failed:', insertError);

  return res.json({
    success: true,
    scanId: scanRecord?.id || null,
    platform: 'twitch',
    cached: false,
    channel: scanResult.channel,
    deals: scanResult.brandsFound,
    uniqueBrands: scanResult.uniqueBrands,
    totalDealsFound: scanResult.totalDealsFound,
    uniqueBrandCount: scanResult.uniqueBrandCount,
    vodsAnalyzed: scanResult.vodsAnalyzed,
    vodsWithDeals: scanResult.vodsWithDeals,
    summary: scanResult.summary,
    creditsUsed,
  });
});

module.exports = router;
