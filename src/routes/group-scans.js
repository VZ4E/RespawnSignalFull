const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// POST /api/group-scans
// Create a parent group scan record to link individual scans under
router.post('/', authMiddleware, async (req, res) => {
  const { group_id, group_name, creator_count, scan_range } = req.body;
  const { user } = req;

  if (!group_id || !group_name) {
    return res.status(400).json({ error: 'group_id and group_name are required' });
  }

  if (!user || !user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    console.log('[Group Scan] Creating parent group scan record for group:', group_name);

    const { data: groupScanRecord, error: insertError } = await supabase
      .from('group_scans')
      .insert({
        user_id: user.id,
        group_id,
        group_name,
        creator_count: creator_count || 0,
        scan_range: scan_range || 3,
        status: 'in_progress',
        deals_found: 0,
        total_credits_used: 0,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Group Scan] Insert error:', insertError);
      console.error('[Group Scan] Insert error message:', insertError.message);
      console.error('[Group Scan] Insert error code:', insertError.code);
      console.error('[Group Scan] Full error:', JSON.stringify(insertError, null, 2));
      return res.status(500).json({ 
        error: 'Failed to create group scan record', 
        details: insertError.message,
        code: insertError.code,
        fullError: insertError
      });
    }

    console.log('[Group Scan] ✓ Created parent record with ID:', groupScanRecord.id);

    return res.json({
      id: groupScanRecord.id,
      group_id,
      group_name,
      creator_count,
      scan_range,
      status: 'in_progress',
    });
  } catch (err) {
    console.error('[Group Scan] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Unexpected error creating group scan', details: err.message });
  }
});

// GET /api/group-scans/:id
// Fetch a specific group scan and its child scans
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { user } = req;

  try {
    const { data: groupScan, error: fetchError } = await supabase
      .from('group_scans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !groupScan) {
      return res.status(404).json({ error: 'Group scan not found' });
    }

    // Fetch all child scans linked to this group
    const { data: childScans } = await supabase
      .from('scans')
      .select('id, username, platform, deals, video_count, credits_used, created_at')
      .eq('group_scan_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return res.json({
      ...groupScan,
      child_scans: childScans || [],
      child_count: (childScans || []).length,
    });
  } catch (err) {
    console.error('[Group Scan] Fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch group scan', details: err.message });
  }
});

// PATCH /api/group-scans/:id
// Update group scan status (mark as complete, etc.)
router.patch('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { user } = req;
  const { status, deals_found, total_credits_used } = req.body;

  try {
    const updateData = {};
    if (status) updateData.status = status;
    if (deals_found !== undefined) updateData.deals_found = deals_found;
    if (total_credits_used !== undefined) updateData.total_credits_used = total_credits_used;

    const { data: updated, error: updateError } = await supabase
      .from('group_scans')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !updated) {
      return res.status(404).json({ error: 'Group scan not found' });
    }

    console.log('[Group Scan] ✓ Updated group scan', id, 'status:', status);

    return res.json(updated);
  } catch (err) {
    console.error('[Group Scan] Update error:', err.message);
    return res.status(500).json({ error: 'Failed to update group scan', details: err.message });
  }
});

module.exports = router;
