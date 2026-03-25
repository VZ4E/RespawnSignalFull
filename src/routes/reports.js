const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { generateCreatorReport, generateAndEmailReport, generateBulkReports } = require('../services/reportService');

// GET /api/reports/preview - Preview a report without sending
router.get('/preview', authMiddleware, async (req, res) => {
  try {
    const { creator, platform = 'tiktok', month, year } = req.query;

    if (!creator) {
      return res.status(400).json({ error: 'creator handle required' });
    }

    const reportData = await generateCreatorReport(req.user.id, creator, platform, { month, year });
    res.json(reportData);
  } catch (err) {
    console.error('[Reports] Preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/send - Send report for single creator
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { creator, platform = 'tiktok', email, month, year } = req.body;

    if (!creator || !email) {
      return res.status(400).json({ error: 'creator and email required' });
    }

    // Validate email belongs to user or is admin
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    // For now, allow sending to user's own email or any email (agencies can send to team members)
    // TODO: Add team management to verify recipients

    console.log(`[Reports] Sending report for ${creator} to ${email}`);

    const result = await generateAndEmailReport(req.user.id, email, creator, platform, { month, year });

    res.json({ success: true, message: `Report sent to ${email}`, ...result });
  } catch (err) {
    console.error('[Reports] Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/send-bulk - Send reports for all creators
router.post('/send-bulk', authMiddleware, async (req, res) => {
  try {
    const { email, month, year } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }

    console.log(`[Reports] Sending bulk reports to ${email}`);

    // Run async in background
    generateBulkReports(req.user.id, email, { month, year }).catch((err) => {
      console.error('[Reports] Bulk send background error:', err.message);
    });

    res.json({ success: true, message: 'Generating reports... you will receive them shortly' });
  } catch (err) {
    console.error('[Reports] Bulk send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/history - Get report history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('reports_log')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ reports: logs || [] });
  } catch (err) {
    console.error('[Reports] History error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/creators - Get list of creators user monitors
router.get('/creators', authMiddleware, async (req, res) => {
  try {
    console.log(`[Reports] Fetching creators for user ${req.user.id}`);
    
    const { data: creators, error } = await supabase
      .from('scans')
      .select('username, platform')
      .eq('user_id', req.user.id)
      .order('username');

    if (error) {
      console.error('[Reports] Query error:', error);
      throw error;
    }

    console.log(`[Reports] Found ${creators?.length || 0} scan records for user ${req.user.id}:`, creators);

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

    console.log(`[Reports] Returning ${unique.length} unique creators`);
    res.json({ creators: unique });
  } catch (err) {
    console.error('[Reports] Creators list error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
