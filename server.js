require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const billingRoutes = require('./src/routes/billing');
const scanRoutes = require('./src/routes/scan');
const creatorRoutes = require('./src/routes/creators');
const configRoutes = require('./src/routes/configs');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Railway's proxy (required for express-rate-limit behind load balancer)
app.set('trust proxy', 1);

// Middleware
app.use(cors());
// Stripe webhook needs raw body — must be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Rate limit scan endpoint
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
app.use('/api/creators', creatorRoutes);
app.use('/api/configs', configRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Respawn Signal' }));

// OAuth callback — let frontend handle token from URL fragment
app.get('/auth/callback', (req, res) => res.redirect('/?oauth=1'));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Respawn Signal running on port ${PORT}`);
});
