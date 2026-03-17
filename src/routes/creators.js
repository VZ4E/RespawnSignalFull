const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/creators - List all creators for user
router.get('/', async (req, res) => {
  try {
    const { data: creators, error } = await supabase
      .from('creators')
      .select(`
        id,
        display_name,
        notes,
        is_agency,
        created_at,
        creator_accounts(
          id,
          platform,
          handle,
          platform_id
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      creators: creators.map(c => ({
        id: c.id,
        display_name: c.display_name,
        is_agency: c.is_agency,
        notes: c.notes,
        accounts: c.creator_accounts || [],
        created_at: c.created_at
      }))
    });
  } catch (err) {
    console.error('GET /api/creators error:', err.message);
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
});

// POST /api/creators - Create a new creator
router.post('/', async (req, res) => {
  const { display_name, notes, is_agency } = req.body;

  if (!display_name || typeof display_name !== 'string') {
    return res.status(400).json({ error: 'display_name is required' });
  }

  try {
    const { data, error } = await supabase
      .from('creators')
      .insert([
        {
          user_id: req.user.id,
          display_name: display_name.trim(),
          notes: notes || null,
          is_agency: is_agency || false
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: data.id,
      display_name: data.display_name,
      is_agency: data.is_agency,
      accounts: []
    });
  } catch (err) {
    console.error('POST /api/creators error:', err.message);
    res.status(500).json({ error: 'Failed to create creator' });
  }
});

// GET /api/creators/:id - Get single creator with accounts
router.get('/:id', async (req, res) => {
  try {
    const { data: creator, error } = await supabase
      .from('creators')
      .select(`
        id,
        display_name,
        notes,
        is_agency,
        creator_accounts(
          id,
          platform,
          handle,
          platform_id
        )
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    res.json({
      id: creator.id,
      display_name: creator.display_name,
      is_agency: creator.is_agency,
      notes: creator.notes,
      accounts: creator.creator_accounts || []
    });
  } catch (err) {
    console.error('GET /api/creators/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch creator' });
  }
});

// PUT /api/creators/:id - Update creator
router.put('/:id', async (req, res) => {
  const { display_name, notes, is_agency } = req.body;

  try {
    // Verify ownership
    const { data: creator, error: checkErr } = await supabase
      .from('creators')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !creator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = {};
    if (display_name) updates.display_name = display_name.trim();
    if (notes !== undefined) updates.notes = notes;
    if (is_agency !== undefined) updates.is_agency = is_agency;

    const { data, error } = await supabase
      .from('creators')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, creator: data });
  } catch (err) {
    console.error('PUT /api/creators/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update creator' });
  }
});

// DELETE /api/creators/:id - Delete creator (cascade deletes accounts)
router.delete('/:id', async (req, res) => {
  try {
    // Verify ownership
    const { data: creator, error: checkErr } = await supabase
      .from('creators')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !creator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('creators')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'Creator deleted' });
  } catch (err) {
    console.error('DELETE /api/creators/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete creator' });
  }
});

// ─────────────────────────────────────────────────────
// CREATOR ACCOUNTS (Platforms)
// ─────────────────────────────────────────────────────

// POST /api/creators/:id/accounts - Add platform account
router.post('/:id/accounts', async (req, res) => {
  const { platform, handle, platform_id } = req.body;

  if (!platform || !handle) {
    return res.status(400).json({ error: 'platform and handle required' });
  }

  const validPlatforms = ['tiktok', 'youtube', 'twitch', 'instagram'];
  if (!validPlatforms.includes(platform.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid platform' });
  }

  try {
    // Verify creator ownership
    const { data: creator, error: checkErr } = await supabase
      .from('creators')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !creator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if account already exists on this creator
    const { data: existing } = await supabase
      .from('creator_accounts')
      .select('id')
      .eq('creator_id', req.params.id)
      .eq('platform', platform.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Creator already has account on this platform' });
    }

    const { data, error } = await supabase
      .from('creator_accounts')
      .insert([
        {
          creator_id: req.params.id,
          platform: platform.toLowerCase(),
          handle: handle.trim(),
          platform_id: platform_id || handle
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      id: data.id,
      platform: data.platform,
      handle: data.handle,
      platform_id: data.platform_id
    });
  } catch (err) {
    console.error('POST /api/creators/:id/accounts error:', err.message);
    res.status(500).json({ error: 'Failed to add account' });
  }
});

// DELETE /api/creators/:id/accounts/:accountId - Remove platform account
router.delete('/:id/accounts/:accountId', async (req, res) => {
  try {
    // Verify creator ownership
    const { data: creator, error: checkErr } = await supabase
      .from('creators')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !creator) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('creator_accounts')
      .delete()
      .eq('id', req.params.accountId)
      .eq('creator_id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'Account removed' });
  } catch (err) {
    console.error('DELETE /api/creators/:id/accounts/:accountId error:', err.message);
    res.status(500).json({ error: 'Failed to remove account' });
  }
});

module.exports = router;
