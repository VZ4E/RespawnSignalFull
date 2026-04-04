const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { runAutomationScheduler } = require('../services/automationScheduler');

/**
 * Calculate next_run_at based on frequency
 */
function calculateNextRunAt(frequency) {
  const now = new Date();
  let daysToAdd = 0;

  switch (frequency) {
    case 'twice_weekly':
      daysToAdd = 3.5; // 3.5 days
      break;
    case 'weekly':
      daysToAdd = 7;
      break;
    case 'biweekly':
      daysToAdd = 14;
      break;
    case 'monthly':
      daysToAdd = 30;
      break;
    default:
      daysToAdd = 7; // default to weekly
  }

  const nextRun = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return nextRun.toISOString();
}

/**
 * GET /api/automations
 * Fetch all automations for the current user
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { dbUser } = req;

    console.log(`[Automations] GET — fetching automations for user ${dbUser.id}`);

    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Automations] Query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch automations' });
    }

    console.log(`[Automations] Found ${(data || []).length} automations`);

    return res.json(data || []);
  } catch (err) {
    console.error('[Automations] GET error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch automations' });
  }
});

/**
 * POST /api/automations
 * Create a new automation
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { dbUser } = req;
    const { creator_username, platform = 'tiktok', frequency, email } = req.body;

    // Validate required fields
    if (!creator_username || !frequency || !email) {
      return res.status(400).json({ error: 'creator_username, frequency, and email are required' });
    }

    // Validate frequency
    const validFrequencies = ['twice_weekly', 'weekly', 'biweekly', 'monthly'];
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({ error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` });
    }

    console.log(`[Automations] POST — creating automation for user ${dbUser.id}, creator ${creator_username}`);

    // Calculate next_run_at
    const nextRunAt = calculateNextRunAt(frequency);

    // Insert automation
    const { data, error } = await supabase
      .from('automations')
      .insert({
        user_id: dbUser.id,
        creator_username: creator_username.toLowerCase().trim().replace(/^@/, ''),
        platform,
        frequency,
        email,
        next_run_at: nextRunAt,
        active: true,
      })
      .select();

    if (error) {
      console.error('[Automations] Insert error:', error.message);
      // Check if it's a unique constraint violation (duplicate automation)
      if (error.code === '23505') {
        return res.status(409).json({ error: `Automation already exists for ${creator_username}` });
      }
      return res.status(500).json({ error: 'Failed to create automation' });
    }

    console.log(`[Automations] ✓ Created automation:`, data[0]);

    return res.json(data[0]);
  } catch (err) {
    console.error('[Automations] POST error:', err.message);
    return res.status(500).json({ error: 'Failed to create automation' });
  }
});

/**
 * PATCH /api/automations/:id
 * Update an automation (toggle active, change frequency, update email)
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { dbUser } = req;
    const automationId = req.params.id;
    const { active, frequency, email } = req.body;

    console.log(`[Automations] PATCH — updating automation ${automationId} for user ${dbUser.id}`);

    // Build update object
    const updates = {};
    if (active !== undefined) updates.active = active;
    if (frequency !== undefined) {
      const validFrequencies = ['twice_weekly', 'weekly', 'biweekly', 'monthly'];
      if (!validFrequencies.includes(frequency)) {
        return res.status(400).json({ error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` });
      }
      updates.frequency = frequency;
      // Recalculate next_run_at when frequency changes
      updates.next_run_at = calculateNextRunAt(frequency);
    }
    if (email !== undefined) updates.email = email;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Update (verify ownership)
    const { data, error } = await supabase
      .from('automations')
      .update(updates)
      .eq('id', automationId)
      .eq('user_id', dbUser.id) // Ensure user owns this automation
      .select();

    if (error) {
      console.error('[Automations] Update error:', error.message);
      return res.status(500).json({ error: 'Failed to update automation' });
    }

    if (!data || data.length === 0) {
      console.warn(`[Automations] Automation ${automationId} not found or not owned by user ${dbUser.id}`);
      return res.status(404).json({ error: 'Automation not found' });
    }

    console.log(`[Automations] ✓ Updated automation:`, data[0]);

    return res.json(data[0]);
  } catch (err) {
    console.error('[Automations] PATCH error:', err.message);
    return res.status(500).json({ error: 'Failed to update automation' });
  }
});

/**
 * DELETE /api/automations/:id
 * Delete an automation
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { dbUser } = req;
    const automationId = req.params.id;

    console.log(`[Automations] DELETE — deleting automation ${automationId} for user ${dbUser.id}`);

    // Delete (verify ownership)
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', automationId)
      .eq('user_id', dbUser.id); // Ensure user owns this automation

    if (error) {
      console.error('[Automations] Delete error:', error.message);
      return res.status(500).json({ error: 'Failed to delete automation' });
    }

    console.log(`[Automations] ✓ Deleted automation ${automationId}`);

    return res.json({ success: true });
  } catch (err) {
    console.error('[Automations] DELETE error:', err.message);
    return res.status(500).json({ error: 'Failed to delete automation' });
  }
});

/**
 * POST /api/automations/trigger-test
 * Manual trigger for testing the automation scheduler
 */
router.post('/trigger-test', authMiddleware, async (req, res) => {
  try {
    console.log('[AutomationScheduler] Manual trigger fired by user', req.dbUser.id);
    await runAutomationScheduler();
    res.json({ success: true, message: 'Automation scheduler triggered manually' });
  } catch (err) {
    console.error('[AutomationScheduler] Manual trigger error:', err.message);
    res.status(500).json({ error: 'Failed to trigger scheduler: ' + err.message });
  }
});

module.exports = router;
