const { supabase } = require('../supabase');

const PLAN_DEFAULTS = {
  pro: { credits: 300, maxRange: 14, automation: false, unlimitedHistory: false },
  max: { credits: 1000, maxRange: 30, automation: true, unlimitedHistory: true },
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
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

    req.user = user;

    // Fetch or create DB user row
    let { data: dbUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();

    if (!dbUser) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({ email: user.email, plan: 'pro', credits_remaining: 300 })
        .select()
        .single();
      dbUser = newUser;
    }

    req.dbUser = dbUser;
    req.planConfig = PLAN_DEFAULTS[dbUser.plan] || PLAN_DEFAULTS.pro;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Auth failed' });
  }
}

module.exports = { authMiddleware, PLAN_DEFAULTS };
