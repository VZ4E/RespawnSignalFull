const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });

  return res.json({ user: data.user, session: data.session });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });

  return res.json({ user: data.user, session: data.session });
});

// POST /api/auth/exchange-code — PKCE code exchange
router.post('/exchange-code', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({
      access_token: data.session?.access_token,
      user: data.user,
    });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/google-url
router.get('/google-url', async (req, res) => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/callback.html`,
    },
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ url: data.url });
});

// GET /auth/callback — Google OAuth redirect lands here
router.get('/callback', async (req, res) => {
  // Supabase handles token exchange client-side via fragment — just serve the app
  res.redirect('/?oauth=1');
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, async (req, res) => {
  await supabase.auth.signOut();
  return res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  const { email, plan, credits_remaining, created_at } = req.dbUser;
  return res.json({ email, plan, credits_remaining, created_at });
});

module.exports = router;
