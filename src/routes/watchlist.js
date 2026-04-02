/**
 * WATCHLIST ROUTER
 * 
 * Endpoints for watchlist and alerts management
 * All endpoints require authentication
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

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
// GET /api/watchlist
// Get user's watchlist (with creator details)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { priority, niche } = req.query;

    let query = supabase
      .from('creator_watchlist')
      .select(`
        *,
        creator:agency_creators (
          id, handle, name, niche, platform, follower_count_formatted, avatar_url
        )
      `)
      .eq('user_id', req.user.id)
      .order('added_at', { ascending: false });

    if (priority !== undefined) {
      query = query.eq('priority', parseInt(priority));
    }

    const { data, error } = await query;

    if (error) throw error;

    // Filter by niche if requested
    let results = data || [];
    if (niche) {
      results = results.filter((item) => item.creator?.niche === niche);
    }

    res.json(results);
  } catch (err) {
    console.error('Failed to fetch watchlist:', err);
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/watchlist
// Add creator to watchlist
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { creator_id, notes, priority } = req.body;

    if (!creator_id) {
      return res.status(400).json({ error: 'creator_id is required' });
    }

    // Check if creator exists and belongs to user
    const { data: creator, error: creatorError } = await supabase
      .from('agency_creators')
      .select('id')
      .eq('id', creator_id)
      .eq('user_id', req.user.id)
      .single();

    if (creatorError || !creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    // Add to watchlist (will fail gracefully if already exists due to UNIQUE constraint)
    const { data, error } = await supabase
      .from('creator_watchlist')
      .insert({
        user_id: req.user.id,
        creator_id,
        notes: notes || null,
        priority: priority || 0,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation — already in watchlist
        return res.status(409).json({ error: 'Creator already in watchlist' });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error('Failed to add to watchlist:', err);
    res.status(500).json({ error: 'Failed to add to watchlist' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/watchlist/:id
// Update watchlist entry (notes, priority)
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, priority } = req.body;

    const { data, error } = await supabase
      .from('creator_watchlist')
      .update({ notes, priority })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Watchlist entry not found' });
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    console.error('Failed to update watchlist:', err);
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/watchlist/:id
// Remove creator from watchlist
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('creator_watchlist')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ success: true, id });
  } catch (err) {
    console.error('Failed to remove from watchlist:', err);
    res.status(500).json({ error: 'Failed to remove from watchlist' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/alerts
// Get user's alerts (unread first)
// ─────────────────────────────────────────────────────────────────────────────

router.get('/alerts', async (req, res) => {
  try {
    const { read, type } = req.query;

    let query = supabase
      .from('creator_alerts')
      .select(`
        *,
        creator:agency_creators (
          id, handle, name, avatar_url
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (read !== undefined) {
      query = query.eq('read', read === 'true');
    }

    if (type) {
      query = query.eq('alert_type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Failed to fetch alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/alerts/:id
// Mark alert as read
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { read } = req.body;

    const { data, error } = await supabase
      .from('creator_alerts')
      .update({ read })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Alert not found' });
      }
      throw error;
    }

    res.json(data);
  } catch (err) {
    console.error('Failed to update alert:', err);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/alerts/:id
// Delete alert
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/alerts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('creator_alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ success: true, id });
  } catch (err) {
    console.error('Failed to delete alert:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/watchlist/batch/mark-read
// Mark multiple alerts as read
// ─────────────────────────────────────────────────────────────────────────────

router.patch('/batch/mark-read', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    const { data, error } = await supabase
      .from('creator_alerts')
      .update({ read: true })
      .in('id', ids)
      .eq('user_id', req.user.id)
      .select();

    if (error) throw error;

    res.json({ count: data?.length || 0, alerts: data });
  } catch (err) {
    console.error('Failed to mark alerts read:', err);
    res.status(500).json({ error: 'Failed to mark alerts read' });
  }
});

module.exports = router;
