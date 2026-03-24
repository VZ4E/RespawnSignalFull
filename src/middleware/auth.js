const { supabase } = require('../supabase');

const PLAN_DEFAULTS = {
  none: { credits: 0, maxRange: 0, automation: false, unlimitedHistory: false },
  starter: { credits: 1000, maxRange: 30, automation: false, unlimitedHistory: false },
  pro: { credits: 2500, maxRange: 30, automation: true, unlimitedHistory: true },
  agency: { credits: 5000, maxRange: 30, automation: true, unlimitedHistory: true },
  enterprise: { credits: 9999, maxRange: 30, automation: true, unlimitedHistory: true },
};

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
      console.error('getUser error:', error.message);
      return res.status(401).json({ error: 'Invalid or expired token: ' + error.message });
    }
    if (!user) return res.status(401).json({ error: 'No user found for token' });

    req.user = user;

    // Fetch or create DB user row
    let { data: dbUser, error: dbErr } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();

    if (dbErr && dbErr.code !== 'PGRST116') {
      console.error('DB user fetch error:', dbErr.message);
    }

    if (!dbUser) {
      const { data: newUser, error: insertErr } = await supabase
        .from('users')
        .insert({ email: user.email, plan: 'none', credits_remaining: 0 })
        .select()
        .single();
      if (insertErr) console.error('User insert error:', insertErr.message);
      dbUser = newUser;
    }

    if (!dbUser) return res.status(500).json({ error: 'Failed to load user profile' });

    req.dbUser = dbUser;
    req.planConfig = PLAN_DEFAULTS[dbUser.plan] || PLAN_DEFAULTS.starter;
    next();
  } catch (err) {
    console.error('Auth middleware exception:', err.message);
    return res.status(401).json({ error: 'Auth failed: ' + err.message });
  }
}

module.exports = { authMiddleware, PLAN_DEFAULTS };
