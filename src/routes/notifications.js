/**
 * Notification Routes
 * Handles Slack webhooks, notification preferences, and notification history
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
const { sendSlackNotification } = require('../services/notificationService');

// ──────────────────────────────────────────────────────────
// GET /api/notifications/preferences
// Retrieve user's notification settings
// ──────────────────────────────────────────────────────────

router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const { data: prefs, error } = await supabase
      .from('users')
      .select('slack_webhook_url, notification_on_deals, notification_on_every_deal, notification_on_low_credits')
      .eq('id', req.dbUser.id)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({
      slack_webhook_url: prefs.slack_webhook_url || null,
      notification_on_deals: prefs.notification_on_deals !== false, // Default true
      notification_on_every_deal: prefs.notification_on_every_deal === true,
      notification_on_low_credits: prefs.notification_on_low_credits !== false,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/notifications/preferences
// Update user's notification settings
// ──────────────────────────────────────────────────────────

router.post('/preferences', authMiddleware, async (req, res) => {
  const { slack_webhook_url, notification_on_deals, notification_on_every_deal, notification_on_low_credits } =
    req.body;

  try {
    // Test Slack webhook if provided
    if (slack_webhook_url && slack_webhook_url.trim()) {
      const isValid = await sendSlackNotification(slack_webhook_url, '✅ Slack integration test successful!');
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid Slack webhook URL. Could not send test message.' });
      }
    }

    // Update user preferences
    const { data, error } = await supabase
      .from('users')
      .update({
        slack_webhook_url: slack_webhook_url || null,
        notification_on_deals: notification_on_deals !== false,
        notification_on_every_deal: notification_on_every_deal === true,
        notification_on_low_credits: notification_on_low_credits !== false,
      })
      .eq('id', req.dbUser.id)
      .select();

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ success: true, preferences: data[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/notifications/test-slack
// Send a test Slack notification
// ──────────────────────────────────────────────────────────

router.post('/test-slack', authMiddleware, async (req, res) => {
  const { slack_webhook_url } = req.body;

  if (!slack_webhook_url) {
    return res.status(400).json({ error: 'slack_webhook_url required' });
  }

  try {
    const success = await sendSlackNotification(
      slack_webhook_url,
      `✅ Test notification from RespawnSignal for ${req.dbUser.email}`
    );

    if (!success) {
      return res.status(400).json({ error: 'Failed to send test message. Check webhook URL.' });
    }

    return res.json({ success: true, message: 'Test notification sent to Slack!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/notifications/history
// Get user's recent notifications
// ──────────────────────────────────────────────────────────

router.get('/history', authMiddleware, async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;

  try {
    const { data, error } = await supabase
      .from('notifications_log')
      .select('*')
      .eq('user_id', req.dbUser.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(500).json({ error: error.message });

    return res.json({ notifications: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// POST /api/notifications/test-email
// Send a test email notification (placeholder)
// ──────────────────────────────────────────────────────────

router.post('/test-email', authMiddleware, async (req, res) => {
  // TODO: Implement email notifications (SendGrid, Resend, etc.)
  return res.json({
    success: true,
    message: 'Email notifications coming soon!',
    status: 'not_implemented',
  });
});

module.exports = router;
