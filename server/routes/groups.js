/**
 * GROUPS ROUTER
 * 
 * Endpoints for managing creator groups and group scans
 * All endpoints require authentication
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { queue } = require('../lib/queue');  // Background job queue

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Verify JWT Token
// ─────────────────────────────────────────────────────────────────────────────

async function verifyAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

router.use(verifyAuth);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups
// List all creator groups for user
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('creator_groups')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('scan_status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Failed to fetch groups:', err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups/:id
// Get group with creators
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch group
    const { data: group, error: groupError } = await supabase
      .from('creator_groups')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Fetch creators in group
    const { data: creators, error: creatorsError } = await supabase
      .from('group_creators')
      .select(`
        *,
        creator:agency_creators (
          id, handle, name, niche, platform, follower_count_formatted, avatar_url
        )
      `)
      .eq('group_id', id)
      .order('added_at', { ascending: false });

    if (creatorsError) throw creatorsError;

    res.json({
      ...group,
      creators: creators || [],
    });
  } catch (err) {
    console.error('Failed to fetch group:', err);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups
// Create a new creator group
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { name, description, creator_ids } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    // Create group
    const { data: group, error: groupError } = await supabase
      .from('creator_groups')
      .insert({
        user_id: req.user.id,
        name,
        description: description || null,
      })
      .select()
      .single();

    if (groupError) throw groupError;

    // Add creators to group (if provided)
    if (Array.isArray(creator_ids) && creator_ids.length > 0) {
      const groupCreators = creator_ids.map((creator_id) => ({
        group_id: group.id,
        creator_id,
      }));

      const { error: addError } = await supabase
        .from('group_creators')
        .insert(groupCreators);

      if (addError) throw addError;
    }

    res.status(201).json(group);
  } catch (err) {
    console.error('Failed to create group:', err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/groups/:id
// Update group info
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Verify ownership
    const { data: group, error: fetchError } = await supabase
      .from('creator_groups')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Update
    const { data, error } = await supabase
      .from('creator_groups')
      .update({ name, description })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Failed to update group:', err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/groups/:id
// Delete a group (cascades to group_creators)
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { data: group, error: fetchError } = await supabase
      .from('creator_groups')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Delete
    const { error } = await supabase
      .from('creator_groups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, id });
  } catch (err) {
    console.error('Failed to delete group:', err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups/:id/creators
// Add creators to a group
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:id/creators', async (req, res) => {
  try {
    const { id } = req.params;
    const { creator_ids } = req.body;

    if (!Array.isArray(creator_ids) || creator_ids.length === 0) {
      return res.status(400).json({ error: 'creator_ids array is required' });
    }

    // Verify group ownership
    const { data: group, error: groupError } = await supabase
      .from('creator_groups')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Add creators (ignore duplicates)
    const groupCreators = creator_ids.map((creator_id) => ({
      group_id: id,
      creator_id,
    }));

    const { data, error } = await supabase
      .from('group_creators')
      .upsert(groupCreators, { onConflict: 'group_id,creator_id' })
      .select();

    if (error) throw error;

    res.status(201).json({ count: data?.length || 0, created: data });
  } catch (err) {
    console.error('Failed to add creators to group:', err);
    res.status(500).json({ error: 'Failed to add creators to group' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/groups/:id/creators/:creatorId
// Remove creator from group
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:id/creators/:creatorId', async (req, res) => {
  try {
    const { id, creatorId } = req.params;

    // Verify group ownership
    const { data: group, error: groupError } = await supabase
      .from('creator_groups')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Delete
    const { error } = await supabase
      .from('group_creators')
      .delete()
      .eq('group_id', id)
      .eq('creator_id', creatorId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to remove creator from group:', err);
    res.status(500).json({ error: 'Failed to remove creator from group' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/groups/:id/scan
// Start a scan job for a group
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:id/scan', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify group ownership
    const { data: group, error: groupError } = await supabase
      .from('creator_groups')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Create scan job record
    const { data: job, error: jobError } = await supabase
      .from('scan_jobs')
      .insert({
        user_id: req.user.id,
        group_id: id,
        job_status: 'queued',
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Queue background job (implement this per your job queue system)
    // Example with Bull queue or similar
    queue.add('scan-group', {
      jobId: job.id,
      userId: req.user.id,
      groupId: id,
    });

    res.status(202).json({
      job_id: job.id,
      status: 'queued',
      message: 'Scan job queued, will start processing soon',
    });
  } catch (err) {
    console.error('Failed to start scan:', err);
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/groups/:id/scan
// Get scan job status
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:id/scan', async (req, res) => {
  try {
    const { id } = req.params;

    // Get latest scan job for group
    const { data, error } = await supabase
      .from('scan_jobs')
      .select('*')
      .eq('group_id', id)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return res.json({ status: 'no_job' });
    }

    res.json(data);
  } catch (err) {
    console.error('Failed to fetch scan status:', err);
    res.status(500).json({ error: 'Failed to fetch scan status' });
  }
});

module.exports = router;
