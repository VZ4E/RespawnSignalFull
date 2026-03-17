const express = require('express');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/configs - List all scan configs for user
router.get('/', async (req, res) => {
  try {
    const { data: configs, error } = await supabase
      .from('scan_configs')
      .select(`
        id,
        name,
        description,
        is_agency,
        created_at,
        config_members(
          count
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      configs: configs.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        is_agency: c.is_agency,
        members: c.config_members?.length || 0,
        created_at: c.created_at
      }))
    });
  } catch (err) {
    console.error('GET /api/configs error:', err.message);
    res.status(500).json({ error: 'Failed to fetch configs' });
  }
});

// POST /api/configs - Create a new scan config
router.post('/', async (req, res) => {
  const { name, description, is_agency, creator_account_ids } = req.body;

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }

  if (!Array.isArray(creator_account_ids) || creator_account_ids.length === 0) {
    return res.status(400).json({ error: 'creator_account_ids array required' });
  }

  try {
    // Create config
    const { data: config, error: configErr } = await supabase
      .from('scan_configs')
      .insert([
        {
          user_id: req.user.id,
          name: name.trim(),
          description: description || null,
          is_agency: is_agency !== false
        }
      ])
      .select()
      .single();

    if (configErr) throw configErr;

    // Add members
    const members = creator_account_ids.map(caId => ({
      config_id: config.id,
      creator_account_id: caId
    }));

    const { error: membersErr } = await supabase
      .from('config_members')
      .insert(members);

    if (membersErr) throw membersErr;

    res.status(201).json({
      id: config.id,
      name: config.name,
      description: config.description,
      is_agency: config.is_agency,
      members: creator_account_ids.length
    });
  } catch (err) {
    console.error('POST /api/configs error:', err.message);
    res.status(500).json({ error: 'Failed to create config' });
  }
});

// GET /api/configs/:id - Get single config with members
router.get('/:id', async (req, res) => {
  try {
    const { data: config, error } = await supabase
      .from('scan_configs')
      .select(`
        id,
        name,
        description,
        is_agency,
        created_at,
        config_members(
          creator_account_id,
          creator_accounts(
            id,
            platform,
            handle,
            creator_id,
            creators(
              id,
              display_name
            )
          )
        )
      `)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    res.json({
      id: config.id,
      name: config.name,
      description: config.description,
      is_agency: config.is_agency,
      members: config.config_members || [],
      created_at: config.created_at
    });
  } catch (err) {
    console.error('GET /api/configs/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

// PUT /api/configs/:id - Update config
router.put('/:id', async (req, res) => {
  const { name, description, is_agency, creator_account_ids } = req.body;

  try {
    // Verify ownership
    const { data: config, error: checkErr } = await supabase
      .from('scan_configs')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !config) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update config
    const updates = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (is_agency !== undefined) updates.is_agency = is_agency;

    const { data, error } = await supabase
      .from('scan_configs')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Update members if provided
    if (Array.isArray(creator_account_ids)) {
      // Delete existing members
      await supabase
        .from('config_members')
        .delete()
        .eq('config_id', req.params.id);

      // Add new members
      if (creator_account_ids.length > 0) {
        const members = creator_account_ids.map(caId => ({
          config_id: req.params.id,
          creator_account_id: caId
        }));

        const { error: membersErr } = await supabase
          .from('config_members')
          .insert(members);

        if (membersErr) throw membersErr;
      }
    }

    res.json({ success: true, config: data });
  } catch (err) {
    console.error('PUT /api/configs/:id error:', err.message);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// DELETE /api/configs/:id - Delete config
router.delete('/:id', async (req, res) => {
  try {
    // Verify ownership
    const { data: config, error: checkErr } = await supabase
      .from('scan_configs')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !config) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('scan_configs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true, message: 'Config deleted' });
  } catch (err) {
    console.error('DELETE /api/configs/:id error:', err.message);
    res.status(500).json({ error: 'Failed to delete config' });
  }
});

// ─────────────────────────────────────────────────────
// CONFIG MEMBERS
// ─────────────────────────────────────────────────────

// POST /api/configs/:id/members - Add creator to config
router.post('/:id/members', async (req, res) => {
  const { creator_account_id } = req.body;

  if (!creator_account_id) {
    return res.status(400).json({ error: 'creator_account_id required' });
  }

  try {
    // Verify config ownership
    const { data: config, error: checkErr } = await supabase
      .from('scan_configs')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !config) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('config_members')
      .select('id')
      .eq('config_id', req.params.id)
      .eq('creator_account_id', creator_account_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Creator already in config' });
    }

    const { data, error } = await supabase
      .from('config_members')
      .insert([
        {
          config_id: req.params.id,
          creator_account_id
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, member: data });
  } catch (err) {
    console.error('POST /api/configs/:id/members error:', err.message);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// DELETE /api/configs/:id/members/:memberCreatorAccountId - Remove creator from config
router.delete('/:id/members/:memberCreatorAccountId', async (req, res) => {
  try {
    // Verify config ownership
    const { data: config, error: checkErr } = await supabase
      .from('scan_configs')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (checkErr || !config) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('config_members')
      .delete()
      .eq('config_id', req.params.id)
      .eq('creator_account_id', req.params.memberCreatorAccountId);

    if (error) throw error;

    res.json({ success: true, message: 'Member removed' });
  } catch (err) {
    console.error('DELETE /api/configs/:id/members/:memberCreatorAccountId error:', err.message);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

module.exports = router;
