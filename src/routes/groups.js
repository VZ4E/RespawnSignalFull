const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { notifyOnGroupScanComplete } = require('../services/notificationService');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ────────────────────────────────────────────────
// GROUP CRUD
// ────────────────────────────────────────────────

// GET /api/groups - List all groups for user
router.get('/', async (req, res) => {
  try {
    console.log('[GET /api/groups] ========== REQUEST START ==========');
    console.log('[GET /api/groups] User ID from req.user:', req.user?.id);
    console.log('[GET /api/groups] User email from req.user:', req.user?.email);
    console.log('[GET /api/groups] Auth header present:', !!req.headers.authorization);
    
    if (!req.user || !req.user.id) {
      console.error('[GET /api/groups] MISSING USER - auth middleware failed');
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log('[GET /api/groups] Querying creator_groups for user:', req.user.id);
    
    const { data: groups, error } = await supabase
      .from('creator_groups')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        group_members(id),
        bulk_scans(id, status, completed_at)
      `)
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[GET /api/groups] Supabase query error:', error);
      throw error;
    }

    console.log('[GET /api/groups] Query success - found', groups ? groups.length : 0, 'groups');

    const result = {
      groups: (groups || []).map(g => ({
        id: g.id,
        name: g.name,
        description: g.description,
        memberCount: g.group_members ? g.group_members.length : 0,
        lastScannedAt: g.bulk_scans && g.bulk_scans.length > 0 
          ? g.bulk_scans[0].completed_at 
          : null,
        created_at: g.created_at,
        updated_at: g.updated_at
      }))
    };

    console.log('[GET /api/groups] About to send response - size:', JSON.stringify(result).length, 'bytes');
    console.log('[GET /api/groups] Response object:', JSON.stringify(result, null, 2));
    
    res.setHeader('Content-Type', 'application/json');
    res.json(result);
    
    console.log('[GET /api/groups] ========== REQUEST SUCCESS ==========');
  } catch (err) {
    console.error('[GET /api/groups] ========== REQUEST ERROR ==========');
    console.error('[GET /api/groups] Error message:', err.message);
    console.error('[GET /api/groups] Error name:', err.name);
    console.error('[GET /api/groups] Stack:', err.stack);
    res.status(500).json({ 
      error: 'Failed to fetch groups',
      message: err.message 
    });
  }
});

// POST /api/groups - Create group
router.post('/', async (req, res) => {
  const { name, description } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const { data, error } = await supabase
      .from('creator_groups')
      .insert([
        {
          user_id: req.user.id,
          name: name.trim(),
          description: description || null
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: data.id,
      name: data.name,
      description: data.description,
      memberCount: 0,
      created_at: data.created_at,
      updated_at: data.updated_at
    });
  } catch (err) {
    console.error('POST /api/groups error:', err.message);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// GET /api/groups/bulk-scans/:scanId - Get bulk scan progress/results
// (Defined before /:groupId to avoid route conflicts)
router.get('/bulk-scans/:scanId', async (req, res) => {
  try {
    const { data: scan, error } = await supabase
      .from('bulk_scans')
      .select(`
        id,
        user_id,
        group_id,
        status,
        results,
        started_at,
        completed_at
      `)
      .eq('id', req.params.scanId)
      .single();

    if (error || !scan) {
      return res.status(404).json({ error: 'Bulk scan not found' });
    }

    // Verify ownership
    if (scan.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({
      id: scan.id,
      status: scan.status,
      started_at: scan.started_at,
      completed_at: scan.completed_at,
      results: Array.isArray(scan.results) ? scan.results : [],
      resultCount: Array.isArray(scan.results) ? scan.results.length : 0
    });
  } catch (err) {
    console.error('GET /api/groups/bulk-scans/:scanId error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bulk scan' });
  }
});

// GET /api/groups/:groupId - Get group details with members
router.get('/:groupId', async (req, res) => {
  try {
    const { data: group, error } = await supabase
      .from('creator_groups')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        group_members(id, platform, handle)
      `)
      .eq('id', req.params.groupId)
      .eq('user_id', req.user.id)
      .single();

    if (error || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({
      id: group.id,
      name: group.name,
      description: group.description,
      members: group.group_members || [],
      created_at: group.created_at,
      updated_at: group.updated_at
    });
  } catch (err) {
    console.error('GET /api/groups/:groupId error:', err.message);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// PUT /api/groups/:groupId - Update group
router.put('/:groupId', async (req, res) => {
  const { name, description } = req.body;

  try {
    // Verify ownership
    const { data: group, error: checkErr } = await supabase
      .from('creator_groups')
      .select('id')
      .eq('id', req.params.groupId)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !group) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('creator_groups')
      .update(updates)
      .eq('id', req.params.groupId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      id: data.id,
      name: data.name,
      description: data.description,
      updated_at: data.updated_at
    });
  } catch (err) {
    console.error('PUT /api/groups/:groupId error:', err.message);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/groups/:groupId - Delete group
router.delete('/:groupId', async (req, res) => {
  try {
    // Verify ownership
    const { data: group, error: checkErr } = await supabase
      .from('creator_groups')
      .select('id')
      .eq('id', req.params.groupId)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !group) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('creator_groups')
      .delete()
      .eq('id', req.params.groupId);

    if (error) throw error;

    res.json({ success: true, message: 'Group deleted' });
  } catch (err) {
    console.error('DELETE /api/groups/:groupId error:', err.message);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// ────────────────────────────────────────────────
// GROUP MEMBERS
// ────────────────────────────────────────────────

// POST /api/groups/:groupId/members - Add creator(s) to group
router.post('/:groupId/members', async (req, res) => {
  const { members } = req.body; // Array of { platform, handle }

  if (!Array.isArray(members) || members.length === 0) {
    return res.status(400).json({ error: 'members array required' });
  }

  try {
    // Verify ownership
    const { data: group, error: checkErr } = await supabase
      .from('creator_groups')
      .select('id, group_members(id)')
      .eq('id', req.params.groupId)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !group) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Enforce 20-creator cap
    const currentCount = group.group_members ? group.group_members.length : 0;
    if (currentCount + members.length > 20) {
      return res.status(400).json({ 
        error: `Group member limit exceeded. Max 20 members (currently ${currentCount}).` 
      });
    }

    // Deduplicate (same platform + handle)
    const toInsert = [];
    const seen = new Set();

    for (const m of members) {
      if (!m.platform || !m.handle) continue;
      const key = `${m.platform.toLowerCase()}:${m.handle.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        toInsert.push({
          group_id: req.params.groupId,
          platform: m.platform.toLowerCase(),
          handle: m.handle.trim().replace(/^@/, '').toLowerCase()
        });
      }
    }

    if (toInsert.length === 0) {
      return res.status(400).json({ error: 'No valid members to add' });
    }

    const { data: inserted, error } = await supabase
      .from('group_members')
      .insert(toInsert)
      .select();

    if (error) {
      // If constraint violation, silently continue (dedup on import)
      if (error.code === '23505') {
        return res.json({ 
          success: true, 
          message: 'Members added (duplicates skipped)',
          added: toInsert.length
        });
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      added: inserted.length,
      members: inserted
    });
  } catch (err) {
    console.error('POST /api/groups/:groupId/members error:', err.message);
    res.status(500).json({ error: 'Failed to add members' });
  }
});

// DELETE /api/groups/:groupId/members/:memberId - Remove member
router.delete('/:groupId/members/:memberId', async (req, res) => {
  try {
    // Verify group ownership
    const { data: group, error: checkErr } = await supabase
      .from('creator_groups')
      .select('id')
      .eq('id', req.params.groupId)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !group) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', req.params.memberId)
      .eq('group_id', req.params.groupId);

    if (error) throw error;

    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    console.error('DELETE /api/groups/:groupId/members/:memberId error:', err.message);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ────────────────────────────────────────────────
// BULK SCAN
// ────────────────────────────────────────────────

// POST /api/groups/:groupId/bulk-scan - Start bulk scan (preview/credits check)
router.post('/:groupId/bulk-scan', async (req, res) => {
  const { range = 3 } = req.body;

  try {
    // Verify group ownership and get members
    const { data: group, error: checkErr } = await supabase
      .from('creator_groups')
      .select(`
        id,
        name,
        group_members(id, platform, handle)
      `)
      .eq('id', req.params.groupId)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !group) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const members = group.group_members || [];
    if (members.length === 0) {
      return res.status(400).json({ error: 'Group has no members' });
    }

    // Calculate credits needed (rough estimate: 1 credit per video per member)
    const estimatedCredits = members.length * range;
    const { dbUser } = req;

    if (dbUser.credits_remaining < estimatedCredits) {
      return res.status(402).json({ 
        error: `Insufficient credits. Need ~${estimatedCredits}, have ${dbUser.credits_remaining}`,
        estimatedCredits,
        creditsAvailable: dbUser.credits_remaining
      });
    }

    // Create bulk_scan record in 'pending' status
    const { data: bulkScan, error: scanErr } = await supabase
      .from('bulk_scans')
      .insert([
        {
          user_id: req.user.id,
          group_id: req.params.groupId,
          status: 'pending',
          results: [],
          started_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (scanErr) throw scanErr;

    // Return preview with scan ID
    res.status(202).json({
      id: bulkScan.id,
      groupId: req.params.groupId,
      groupName: group.name,
      status: 'pending',
      memberCount: members.length,
      range,
      estimatedCredits,
      members: members.map(m => ({ id: m.id, platform: m.platform, handle: m.handle })),
      message: 'Preview ready. Ready to scan when you confirm.'
    });
  } catch (err) {
    console.error('POST /api/groups/:groupId/bulk-scan error:', err.message);
    res.status(500).json({ error: 'Failed to start bulk scan' });
  }
});

// GET /api/groups/:groupId/bulk-scans - Get bulk scan history for group
router.get('/:groupId/bulk-scans', async (req, res) => {
  try {
    // Verify ownership
    const { data: group, error: checkErr } = await supabase
      .from('creator_groups')
      .select('id')
      .eq('id', req.params.groupId)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !group) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data: scans, error } = await supabase
      .from('bulk_scans')
      .select('*')
      .eq('group_id', req.params.groupId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      scans: scans.map(s => ({
        id: s.id,
        status: s.status,
        started_at: s.started_at,
        completed_at: s.completed_at,
        resultCount: Array.isArray(s.results) ? s.results.length : 0
      }))
    });
  } catch (err) {
    console.error('GET /api/groups/:groupId/bulk-scans error:', err.message);
    res.status(500).json({ error: 'Failed to fetch bulk scans' });
  }
});

// POST /api/groups/:groupId/bulk-scan/:scanId/complete - Mark bulk scan complete and notify
router.post('/:groupId/bulk-scan/:scanId/complete', async (req, res) => {
  const { results = [], groupName = 'Bulk Scan' } = req.body;

  try {
    // Verify authorization
    const { data: scan, error: checkErr } = await supabase
      .from('bulk_scans')
      .select('user_id')
      .eq('id', req.params.scanId)
      .eq('group_id', req.params.groupId)
      .single();

    if (checkErr || !scan || scan.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update scan status to completed
    const { error: updateErr } = await supabase
      .from('bulk_scans')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        results
      })
      .eq('id', req.params.scanId);

    if (updateErr) throw updateErr;

    // Send notification (non-blocking)
    if (results.length > 0) {
      notifyOnGroupScanComplete(req.user.id, groupName, results).catch(err => {
        console.error('[Notifications] Group scan notification failed:', err.message);
      });
    }

    res.json({ success: true, scanId: req.params.scanId });
  } catch (err) {
    console.error('POST /api/groups/:groupId/bulk-scan/:scanId/complete error:', err.message);
    res.status(500).json({ error: 'Failed to complete bulk scan' });
  }
});

// Note: Bulk scan execution would be triggered from frontend after confirmation,
// or via a separate endpoint. For now, the preview is returned above.

module.exports = router;
