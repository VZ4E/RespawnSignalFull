require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const authRoutes = require('./src/routes/auth');
const billingRoutes = require('./src/routes/billing');
const scanRoutes = require('./src/routes/scan');
const youtubeRoutes = require('./src/routes/youtube');
const instagramRoutes = require('./src/routes/instagram');
const twitchRoutes = require('./src/routes/twitch');
const creatorRoutes = require('./src/routes/creators');
const configRoutes = require('./src/routes/configs');
const groupsRoutes = require('./src/routes/groups');
const notificationsRoutes = require('./src/routes/notifications');
const reportsRoutes = require('./src/routes/reports');
const agencySearchRoutes = require('./src/routes/agency-search');
const supabaseAgenciesRoutes = require('./src/routes/agencies');
const supabaseWatchlistRoutes = require('./src/routes/watchlist');
const supabaseGroupsRoutes = require('./src/routes/supabase-groups');
const groupScansRoutes = require('./src/routes/group-scans');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(cors());
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many scan requests, please wait a minute.' },
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/scan', scanLimiter, scanRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/youtube', scanLimiter, youtubeRoutes);
app.use('/api/instagram', scanLimiter, instagramRoutes);
app.use('/api/twitch', scanLimiter, twitchRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/configs', configRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/group-scans', groupScansRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/agency-search', agencySearchRoutes);

// Supabase routes
app.use('/api/agencies', supabaseAgenciesRoutes);
app.use('/api/watchlist', supabaseWatchlistRoutes);
app.use('/api/supabase-groups', supabaseGroupsRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Respawn Signal' }));
app.get('/auth/callback', (req, res) => res.redirect('/?oauth=1'));

// Policy pages
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy-policy.html'));
});

app.get('/terms-of-service', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'terms-of-service.html'));
});

app.get('/refund-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'refund-policy.html'));
});

app.get('/cookie-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cookie-policy.html'));
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Respawn Signal running on port ${PORT} [Agency Search Modal Fix Deployed]`);
});
