const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/brands/:brandName
 * 
 * Returns all deals containing a specific brand, grouped by creator.
 * Supports query parameters:
 *   - limit: max deals to return (default 100)
 *   - platform: filter by platform ('twitch', 'tiktok', 'youtube', 'instagram')
 */
router.get('/:brandName', authMiddleware, async (req, res) => {
  try {
    const brandNameParam = decodeURIComponent(req.params.brandName);
    const { limit = 100, platform } = req.query;

    console.log(`[Brands] Fetching deals for brand "${brandNameParam}" (encoded: "${req.params.brandName}") user ${req.dbUser.id}`);

    // Query all scans for this user
    const { data: scans, error: scanError } = await supabase
      .from('scans')
      .select('id, username, platform, created_at, deals')
      .eq('user_id', req.dbUser.id)
      .order('created_at', { ascending: false });

    if (scanError) {
      console.error('[Brands] Supabase query error:', scanError.message);
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (!scans || scans.length === 0) {
      console.log('[Brands] No scans found for user');
      return res.status(200).json({
        brand_name: brandNameParam,
        total_deals: 0,
        creators_count: 0,
        date_range: null,
        deals: []
      });
    }

    // Log raw deals for debugging
    const allDealsCount = scans.reduce((count, scan) => count + (scan.deals?.length || 0), 0);
    console.log(`[Brands] Retrieved ${scans.length} scans with ${allDealsCount} total deals`);
    
    // Sample brands from first few deals for debugging
    const sampleBrands = new Set();
    scans.slice(0, 3).forEach(scan => {
      if (scan.deals?.length > 0) {
        scan.deals.slice(0, 2).forEach(deal => {
          if (deal.brands?.length > 0) {
            deal.brands.forEach(b => sampleBrands.add(b));
          }
        });
      }
    });
    console.log(`[Brands] Sample brands from data: ${Array.from(sampleBrands).join(', ')}`);

    // Filter deals by brand name (case-insensitive)
    const matchedDeals = [];
    const brandNameLower = brandNameParam.toLowerCase();

    scans.forEach(scan => {
      if (!scan.deals || !Array.isArray(scan.deals)) return;

      scan.deals.forEach((deal, dealIndex) => {
        if (!deal.brands || !Array.isArray(deal.brands)) return;

        const hasBrand = deal.brands.some(b => b.toLowerCase() === brandNameLower);
        if (hasBrand) {
          matchedDeals.push({
            ...deal,
            username: scan.username,
            platform: scan.platform,
            created_at: scan.created_at,
            scan_id: scan.id,
            deal_index: dealIndex
          });
        }
      });
    });

    console.log(`[Brands] Found ${matchedDeals.length} deals matching brand name "${brandNameLower}"`);

    // Filter by platform if specified
    let filtered = matchedDeals;
    if (platform) {
      filtered = matchedDeals.filter(d => d.platform === platform);
      console.log(`[Brands] Filtered to platform "${platform}": ${filtered.length} deals`);
    }

    // Sort by created_at descending
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Limit results
    const limited = filtered.slice(0, parseInt(limit) || 100);

    // Calculate stats
    const uniqueCreators = new Set(limited.map(d => d.username));
    const uniquePlatforms = new Set(limited.map(d => d.platform));
    const highConfidenceCount = limited.filter(d => d.confidence === 'high').length;
    const activationCount = limited.filter(d => d.is_activation_day === true).length;
    
    let dateRange = null;
    if (limited.length > 0) {
      const dates = limited.map(d => new Date(d.created_at)).sort();
      dateRange = {
        oldest: dates[0].toISOString(),
        newest: dates[dates.length - 1].toISOString()
      };
    }

    console.log(`[Brands] Returning ${limited.length} deals for brand "${brandNameParam}" across ${uniqueCreators.size} creators (high_confidence: ${highConfidenceCount}, activations: ${activationCount})`);

    res.status(200).json({
      brand_name: brandNameParam,
      total_deals: limited.length,
      creators_count: uniqueCreators.size,
      high_confidence_deals: highConfidenceCount,
      activation_streams: activationCount,
      platforms: Array.from(uniquePlatforms),
      date_range: dateRange,
      deals: limited
    });

  } catch (error) {
    console.error('[Brands] Unexpected error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/brands
 * 
 * Returns aggregated brand statistics across all user scans.
 * Shows list of all brands detected with deal counts.
 */
router.get('/', async (req, res) => {
  try {
    // Get user from auth token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log(`[Brands] Fetching all brands for user ${user.id}`);

    // Query all scans for this user
    const { data: scans, error: scanError } = await supabase
      .from('scans')
      .select('deals')
      .eq('user_id', user.id);

    if (scanError) {
      console.error('[Brands] Supabase query error:', scanError.message);
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (!scans || scans.length === 0) {
      console.log('[Brands] No scans found for user');
      return res.status(200).json({
        total_brands: 0,
        brands: []
      });
    }

    // Aggregate all brands with deal counts
    const brandMap = {};

    scans.forEach(scan => {
      if (!scan.deals || !Array.isArray(scan.deals)) return;

      scan.deals.forEach(deal => {
        if (!deal.brands || !Array.isArray(deal.brands)) return;

        deal.brands.forEach(brandName => {
          const key = brandName.toLowerCase();
          if (!brandMap[key]) {
            brandMap[key] = {
              brand_name: brandName,
              deal_count: 0,
              deal_types: new Set(),
              confidence_levels: new Set()
            };
          }
          brandMap[key].deal_count++;
          if (deal.deal_type) brandMap[key].deal_types.add(deal.deal_type);
          if (deal.confidence) brandMap[key].confidence_levels.add(deal.confidence);
        });
      });
    });

    // Convert to array and sort by deal count
    const brands = Object.values(brandMap)
      .map(b => ({
        brand_name: b.brand_name,
        deal_count: b.deal_count,
        deal_types: Array.from(b.deal_types),
        confidence_levels: Array.from(b.confidence_levels)
      }))
      .sort((a, b) => b.deal_count - a.deal_count);

    console.log(`[Brands] Found ${brands.length} unique brands across ${scans.length} scans`);

    res.status(200).json({
      total_brands: brands.length,
      brands
    });

  } catch (error) {
    console.error('[Brands] Unexpected error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/brands/:brandName/report
 * 
 * Generates and saves a brand report.
 * Body:
 *   - format: 'json' | 'pdf' | 'csv' (default: 'json')
 *   - include_evidence: boolean (include deal evidence in report)
 */
router.post('/:brandName/report', authMiddleware, async (req, res) => {
  try {
    const brandNameParam = decodeURIComponent(req.params.brandName);
    const { format = 'json', include_evidence = true } = req.body;

    console.log(`[Brands] Generating ${format} report for brand "${brandNameParam}" user ${req.dbUser.id}`);

    // First, fetch the brand deals (reuse GET logic)
    const { data: scans, error: scanError } = await supabase
      .from('scans')
      .select('id, username, platform, created_at, deals')
      .eq('user_id', req.dbUser.id)
      .order('created_at', { ascending: false });

    if (scanError) {
      console.error('[Brands] Supabase query error:', scanError.message);
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (!scans || scans.length === 0) {
      return res.status(404).json({
        error: 'No scans found for this user'
      });
    }

    // Filter deals by brand name
    const matchedDeals = [];
    const brandNameLower = brandNameParam.toLowerCase();

    scans.forEach(scan => {
      if (!scan.deals || !Array.isArray(scan.deals)) return;

      scan.deals.forEach((deal, dealIndex) => {
        if (!deal.brands || !Array.isArray(deal.brands)) return;

        const hasBrand = deal.brands.some(b => b.toLowerCase() === brandNameLower);
        if (hasBrand) {
          matchedDeals.push({
            ...deal,
            username: scan.username,
            platform: scan.platform,
            created_at: scan.created_at,
            scan_id: scan.id
          });
        }
      });
    });

    if (matchedDeals.length === 0) {
      return res.status(404).json({
        error: `No deals found for brand "${brandNameParam}"`
      });
    }

    // Calculate summary statistics
    const platformBreakdown = {};
    const creatorSet = new Set();
    let highConfidenceCount = 0;
    let activationCount = 0;
    const dealTypes = new Set();
    const postTypes = new Set();

    matchedDeals.forEach(deal => {
      // Platform breakdown
      if (!platformBreakdown[deal.platform]) {
        platformBreakdown[deal.platform] = 0;
      }
      platformBreakdown[deal.platform]++;

      // Creator count
      creatorSet.add(deal.username);

      // Confidence
      if (deal.confidence === 'high') highConfidenceCount++;

      // Activation
      if (deal.is_activation_day) activationCount++;

      // Deal types
      if (deal.deal_type) dealTypes.add(deal.deal_type);
      if (deal.post_type) postTypes.add(deal.post_type);
    });

    // Build report content
    const reportContent = {
      brand_name: brandNameParam,
      report_date: new Date().toISOString(),
      total_deals: matchedDeals.length,
      creators_count: creatorSet.size,
      high_confidence_deals: highConfidenceCount,
      activation_streams: activationCount,
      platform_breakdown: platformBreakdown,
      deal_types: Array.from(dealTypes),
      post_types: Array.from(postTypes),
      date_range: {
        earliest: new Date(Math.min(...matchedDeals.map(d => new Date(d.created_at)))).toISOString(),
        latest: new Date(Math.max(...matchedDeals.map(d => new Date(d.created_at)))).toISOString()
      },
      deals: include_evidence ? matchedDeals : matchedDeals.map(({ evidence, ...deal }) => deal)
    };

    // Store report in database
    // NOTE: user_id must be req.dbUser.id (the app users table ID), not req.user.id (auth ID)
    // req.dbUser.id matches the users table FK and is what the RLS policies expect
    console.log(`[Brands] Inserting report with user_id: ${req.dbUser.id} (app users table ID)`);
    
    const { data: report, error: insertError } = await supabase
      .from('brand_reports')
      .insert({
        user_id: req.dbUser.id,
        brand_name: brandNameParam,
        format: format,
        total_deals: reportContent.total_deals,
        creators_count: reportContent.creators_count,
        high_confidence_deals: reportContent.high_confidence_deals,
        activation_streams: reportContent.activation_streams,
        content: reportContent,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Brands] Report insert error:', insertError.message, 'User ID:', req.dbUser.id);
      return res.status(500).json({ error: 'Failed to save report', details: insertError.message });
    }

    console.log(`[Brands] Report created with ID: ${report.id}`);

    res.status(201).json({
      success: true,
      report_id: report.id,
      brand_name: brandNameParam,
      format: format,
      total_deals: reportContent.total_deals,
      creators_count: reportContent.creators_count,
      high_confidence_deals: reportContent.high_confidence_deals,
      activation_streams: reportContent.activation_streams,
      created_at: report.created_at,
      content: reportContent
    });

  } catch (error) {
    console.error('[Brand Report] Error:', error.message);
    console.error('[Brand Report] Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
