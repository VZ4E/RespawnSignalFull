const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { scanInstagramChannel } = require('../services/instagramScanner');
const planConfig = require('../config/planConfig');
const { authMiddleware } = require('../middleware/authMiddleware');

const CACHE_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const CREDIT_COST = 1; // 1 credit per scan

/**
 * POST /api/instagram/scan
 * Scan Instagram channel for brand deals
 */
router.post('/scan', authMiddleware, async (req, res) => {
  const userId = req.dbUser.id;
  const { channel_input, range } = req.body;

  // Validation
  if (!channel_input || !range) {
    return res.status(400).json({
      error: 'Missing required fields: channel_input, range',
    });
  }

  // Validate range against plan
  const plan = planConfig.plans[req.dbUser.plan] || planConfig.plans.free;
  const rangeConfig = plan.instagram?.[range];

  if (!rangeConfig) {
    return res.status(400).json({
      error: `Invalid range '${range}' for plan ${req.dbUser.plan}`,
    });
  }

  const scanDepth = rangeConfig.depth;
  const creditsRequired = scanDepth * CREDIT_COST;

  try {
    // Check cache first
    const { data: existingScans, error: cacheError } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'instagram')
      .eq('channel_input', channel_input.toLowerCase())
      .eq('range', range)
      .order('created_at', { ascending: false })
      .limit(1);

    if (cacheError) {
      console.error('Cache lookup error:', cacheError);
    }

    // Check if cache is valid (within 3 days)
    if (existingScans && existingScans.length > 0) {
      const lastScan = existingScans[0];
      const cacheAge = Date.now() - new Date(lastScan.created_at).getTime();

      if (cacheAge < CACHE_DURATION_MS) {
        return res.json({
          success: true,
          cached: true,
          scan_id: lastScan.id,
          deals: lastScan.deals,
          brands: lastScan.brands,
          channel_handle: lastScan.channel_handle,
          channel_name: lastScan.channel_name,
          channel_thumbnail: lastScan.channel_thumbnail,
          subscriber_count: lastScan.subscriber_count,
          scan_depth: lastScan.scan_depth,
          created_at: lastScan.created_at,
        });
      }
    }

    // Check user credits
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return res.status(500).json({ error: 'Failed to fetch user credits' });
    }

    if (userData.credits < creditsRequired) {
      return res.status(402).json({
        error: `Insufficient credits. Required: ${creditsRequired}, Available: ${userData.credits}`,
      });
    }

    // Perform the scan
    const scanResult = await scanInstagramChannel(channel_input, scanDepth);

    // Deduct credits (in try/finally to ensure consistency)
    let creditError = null;
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ credits: userData.credits - creditsRequired })
        .eq('id', userId);

      if (updateError) {
        creditError = updateError;
      }
    } catch (err) {
      creditError = err;
    }

    // Persist scan results to database
    const scanData = {
      user_id: userId,
      platform: 'instagram',
      channel_input: channel_input.toLowerCase(),
      channel_handle: scanResult.channel_handle,
      channel_name: scanResult.channel_name,
      channel_thumbnail: scanResult.channel_thumbnail,
      subscriber_count: scanResult.subscriber_count,
      scan_depth: scanDepth,
      range: range,
      deals: scanResult.deals_found,
      brands: scanResult.brands_detected,
      keywords: scanResult.keywords_matched,
      videos_scanned: scanResult.videos_scanned,
    };

    const { data: insertedScan, error: insertError } = await supabase
      .from('scans')
      .insert([scanData])
      .select()
      .single();

    if (insertError) {
      console.error('Failed to persist scan:', insertError);
      // Still return success to user since scan was performed
    }

    // Return response (even if credit deduction had errors, scan succeeded)
    res.json({
      success: true,
      cached: false,
      scan_id: insertedScan?.id,
      deals: scanResult.deals_found,
      brands: scanResult.brands_detected,
      keywords: scanResult.keywords_matched,
      channel_handle: scanResult.channel_handle,
      channel_name: scanResult.channel_name,
      channel_thumbnail: scanResult.channel_thumbnail,
      subscriber_count: scanResult.subscriber_count,
      scan_depth: scanDepth,
      videos_scanned: scanResult.videos_scanned,
      credits_used: creditsRequired,
      credits_remaining: userData.credits - creditsRequired,
      ...(creditError && { credit_warning: 'Credits may not have been deducted due to a database error' }),
    });
  } catch (error) {
    console.error('Instagram scan error:', error);

    // Map errors to HTTP status codes
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: `Instagram channel not found: ${channel_input}`,
      });
    }

    if (error.message.includes('rate limit')) {
      return res.status(502).json({
        error: 'Instagram API rate limited - please try again in a few minutes',
      });
    }

    res.status(500).json({
      error: error.message || 'Failed to scan Instagram channel',
    });
  }
});

module.exports = router;
