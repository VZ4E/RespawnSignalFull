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
const twitchTestRouter = require('./src/routes/twitchTest');

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
app.use('/api/twitch-test', twitchTestRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Respawn Signal' }));
app.get('/auth/callback', (req, res) => res.redirect('/?oauth=1'));

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Respawn Signal running on port ${PORT}`);
});
