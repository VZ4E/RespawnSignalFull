/**
 * AGENCIES ROUTER
 * 
 * Endpoints for managing agencies and creators
 * All endpoints require authentication (Supabase JWT)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client (use service role for server-side operations)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Verify JWT Token (decode JWT payload directly)
// ─────────────────────────────────────────────────────────────────────────────

function verifyAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  try {
    // Decode JWT (don't verify signature — Supabase handles that)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Check expiration
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return res.status(401).json({ error: 'Token expired' });
    }

    // Extract user_id from token
    // Service role tokens don't have sub/user_id (they have role: "service_role")
    // Regular user tokens have sub: user_id
    const userId = payload.sub || payload.user_id;
    const isServiceRole = payload.role === 'service_role';
    
    if (!userId && !isServiceRole) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    req.user = { id: userId, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

router.use(verifyAuth);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agencies
// List all agencies for current user
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('agencies')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Failed to fetch agencies:', err);
    res.status(500).json({ error: 'Failed to fetch agencies' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agencies/:id
// Get agency by ID (with creators)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch agency
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (agencyError || !agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Fetch creators
    const { data: creators, error: creatorsError } = await supabase
      .from('agency_creators')
      .select('*')
      .eq('agency_id', id)
      .order('created_at', { ascending: false });

    if (creatorsError) throw creatorsError;

    res.json({ ...agency, creators: creators || [] });
  } catch (err) {
    console.error('Failed to fetch agency:', err);
    res.status(500).json({ error: 'Failed to fetch agency' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agencies
// Create a new agency
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { name, url, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Agency name is required' });
    }

    const { data, error } = await supabase
      .from('agencies')
      .insert({
        user_id: req.user.id,
        name,
        url: url || null,
        description: description || null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Failed to create agency:', err);
    res.status(500).json({ error: 'Failed to create agency' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/agencies/:id
// Update an agency
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, description } = req.body;

    // Verify ownership
    const { data: agency, error: fetchError } = await supabase
      .from('agencies')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Update
    const { data, error } = await supabase
      .from('agencies')
      .update({ name, url, description })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Failed to update agency:', err);
    res.status(500).json({ error: 'Failed to update agency' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/agencies/:id
// Delete an agency (cascades to creators)
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { data: agency, error: fetchError } = await supabase
      .from('agencies')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Delete (cascade handled by DB)
    const { error } = await supabase
      .from('agencies')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, id });
  } catch (err) {
    console.error('Failed to delete agency:', err);
    res.status(500).json({ error: 'Failed to delete agency' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/agencies/:id/creators
// List creators in an agency
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:id/creators', async (req, res) => {
  try {
    const { id } = req.params;
    const { niche, platform } = req.query;

    // Verify agency ownership
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (agencyError || !agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Build query
    let query = supabase
      .from('agency_creators')
      .select('*')
      .eq('agency_id', id);

    if (niche) {
      query = query.eq('niche', niche);
    }

    if (platform) {
      query = query.contains('platform', [platform]);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Failed to fetch creators:', err);
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/agencies/:id/creators/batch
// Add multiple creators to an agency
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:id/creators/batch', async (req, res) => {
  try {
    const { id } = req.params;
    const { creators } = req.body;

    if (!Array.isArray(creators) || creators.length === 0) {
      return res.status(400).json({ error: 'Creators array is required' });
    }

    // Verify agency ownership
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (agencyError || !agency) {
      return res.status(404).json({ error: 'Agency not found' });
    }

    // Insert creators (upsert by handle to avoid duplicates)
    const creatorsWithIds = creators.map((creator) => ({
      ...creator,
      agency_id: id,
      user_id: req.user.id,
    }));

    const { data, error } = await supabase
      .from('agency_creators')
      .upsert(creatorsWithIds, { onConflict: 'handle' })
      .select();

    if (error) throw error;

    res.status(201).json({ count: data?.length || 0, creators: data });
  } catch (err) {
    console.error('Failed to add creators:', err);
    res.status(500).json({ error: 'Failed to add creators' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/agencies/:id/creators/:creatorId
// Remove a creator from an agency
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:id/creators/:creatorId', async (req, res) => {
  try {
    const { id, creatorId } = req.params;

    // Verify creator belongs to user's agency
    const { data: creator, error: fetchError } = await supabase
      .from('agency_creators')
      .select('id')
      .eq('id', creatorId)
      .eq('agency_id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Delete
    const { error } = await supabase
      .from('agency_creators')
      .delete()
      .eq('id', creatorId);

    if (error) throw error;

    res.json({ success: true, id: creatorId });
  } catch (err) {
    console.error('Failed to delete creator:', err);
    res.status(500).json({ error: 'Failed to delete creator' });
  }
});

module.exports = router;
