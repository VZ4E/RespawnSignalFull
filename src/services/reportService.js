/**
 * Report Service
 * Generates monthly creator activity reports
 */

const { supabase } = require('../supabase');
const { sendCreatorReport } = require('./emailService');

/**
 * Generate report data for a creator
 */
async function generateCreatorReport(userId, creatorHandle, platform = 'tiktok', options = {}) {
  try {
    console.log(`[Report] Generating report for ${creatorHandle} (${platform})`);

    // Get all scans for this creator in the date range
    const { start, end } = getDateRange(options.month, options.year);

    const { data: scans, error: scansError } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', userId)
      .eq('username', creatorHandle.toLowerCase())
      .eq('platform', platform)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (scansError) throw scansError;

    // Extract deals from scans (deals are stored as JSON in scans.deals column)
    const allDeals = [];
    const dealsByDate = [];
    (scans || []).forEach((scan) => {
      const scanDeals = scan.deals || [];
      scanDeals.forEach((deal) => {
        allDeals.push(deal);
        dealsByDate.push({
          ...deal,
          scanned_at: scan.created_at,
          scan_id: scan.id,
        });
      });
    });

    // Aggregate brand data
    const brandMap = {};
    allDeals.forEach((deal) => {
      const brands = deal.brands || [];
      brands.forEach((brand) => {
        if (!brandMap[brand]) {
          brandMap[brand] = { name: brand, count: 0, types: new Set() };
        }
        brandMap[brand].count += 1;
        if (deal.deal_type) brandMap[brand].types.add(deal.deal_type);
      });
    });

    const topBrands = Object.values(brandMap)
      .map((b) => ({ ...b, types: Array.from(b.types) }))
      .sort((a, b) => b.count - a.count);

    const reportData = {
      creatorName: `@${creatorHandle}`,
      platform,
      totalDeals: allDeals.length,
      scanCount: scans?.length || 0,
      dealHistory: dealsByDate,
      topBrands,
      dateRange: {
        start: start.toLocaleDateString(),
        end: end.toLocaleDateString(),
      },
    };

    console.log(`[Report] Generated for ${creatorHandle}: ${reportData.totalDeals} deals, ${reportData.scanCount} scans`);
    return reportData;
  } catch (err) {
    console.error(`[Report] Error generating report for ${creatorHandle}:`, err.message);
    throw err;
  }
}

/**
 * Generate and email report for a creator
 */
async function generateAndEmailReport(userId, email, creatorHandle, platform = 'tiktok', options = {}) {
  try {
    // Generate report data
    const reportData = await generateCreatorReport(userId, creatorHandle, platform, options);

    // Send email
    const result = await sendCreatorReport(email, reportData.creatorName, reportData, {
      whiteLabel: options.whiteLabel,
      from: options.from,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    // Log report sent
    await supabase.from('reports_log').insert({
      user_id: userId,
      creator_handle: creatorHandle.toLowerCase(),
      platform,
      email,
      deals_count: reportData.totalDeals,
      scans_count: reportData.scanCount,
      status: 'sent',
      created_at: new Date().toISOString(),
    });

    console.log(`[Report] ✓ Emailed report for ${creatorHandle} to ${email}`);
    return { success: true, reportData, email };
  } catch (err) {
    console.error(`[Report] Failed to email report:`, err.message);

    // Log failure
    try {
      await supabase.from('reports_log').insert({
        user_id: userId,
        creator_handle: creatorHandle.toLowerCase(),
        platform,
        email,
        status: 'failed',
        error: err.message,
        created_at: new Date().toISOString(),
      });
    } catch (_) {}

    throw err;
  }
}

/**
 * Generate reports for all creators a user monitors
 */
async function generateBulkReports(userId, email, options = {}) {
  try {
    console.log(`[Report] Generating bulk reports for user ${userId}`);

    // Get all unique creators
    const { data: creators, error } = await supabase
      .from('scans')
      .select('username, platform')
      .eq('user_id', userId)
      .order('username');

    if (error) throw error;

    // Deduplicate
    const unique = [];
    const seen = new Set();
    (creators || []).forEach(({ username, platform }) => {
      const key = `${username}-${platform}`;
      if (!seen.has(key)) {
        unique.push({ creator_handle: username, platform });
        seen.add(key);
      }
    });

    console.log(`[Report] Found ${unique.length} unique creators to report on`);

    // Generate reports for each
    const results = [];
    for (const { creator_handle, platform } of unique) {
      try {
        const result = await generateAndEmailReport(userId, email, creator_handle, platform, options);
        results.push(result);
      } catch (err) {
        console.error(`[Report] Failed for ${creator_handle}:`, err.message);
        results.push({ success: false, creator: creator_handle, error: err.message });
      }
    }

    console.log(`[Report] ✓ Bulk reports complete: ${results.filter((r) => r.success).length}/${results.length} sent`);
    return results;
  } catch (err) {
    console.error(`[Report] Bulk report error:`, err.message);
    throw err;
  }
}

/**
 * Get date range for report period
 */
function getDateRange(month, year) {
  const now = new Date();
  const reportYear = year || now.getFullYear();
  const reportMonth = month || now.getMonth(); // 0-indexed

  // Start of month
  const start = new Date(reportYear, reportMonth, 1);

  // End of month
  const end = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59);

  return { start, end };
}

module.exports = {
  generateCreatorReport,
  generateAndEmailReport,
  generateBulkReports,
  getDateRange,
};
