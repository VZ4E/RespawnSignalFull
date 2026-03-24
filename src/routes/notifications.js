const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// GET /api/notifications/preferences - Get user's notification settings
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('slack_webhook_url, notification_on_deals, notification_on_every_deal, notification_on_low_credits')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    res.json({
      slack_webhook_url: user?.slack_webhook_url || '',
      notification_on_deals: user?.notification_on_deals !== false,
      notification_on_every_deal: user?.notification_on_every_deal === true,
      notification_on_low_credits: user?.notification_on_low_credits !== false,
    });
  } catch (err) {
    console.error('GET /api/notifications/preferences error:', err);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// POST /api/notifications/preferences - Save notification settings
router.post('/preferences', authMiddleware, async (req, res) => {
  const { slack_webhook_url, notification_on_deals, notification_on_every_deal, notification_on_low_credits } = req.body;

  try {
    // Validate Slack webhook URL if provided
    if (slack_webhook_url && !slack_webhook_url.startsWith('https://hooks.slack.com/')) {
      return res.status(400).json({ error: 'Invalid Slack webhook URL' });
    }

    const { error } = await supabase
      .from('users')
      .update({
        slack_webhook_url: slack_webhook_url || null,
        notification_on_deals: notification_on_deals !== false,
        notification_on_every_deal: notification_on_every_deal === true,
        notification_on_low_credits: notification_on_low_credits !== false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.user.id);

    if (error) throw error;

    res.json({ success: true, message: 'Preferences saved' });
  } catch (err) {
    console.error('POST /api/notifications/preferences error:', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// POST /api/notifications/test-slack - Test Slack webhook
router.post('/test-slack', authMiddleware, async (req, res) => {
  const { slack_webhook_url } = req.body;

  if (!slack_webhook_url) {
    return res.status(400).json({ error: 'Slack webhook URL required' });
  }

  if (!slack_webhook_url.startsWith('https://hooks.slack.com/')) {
    return res.status(400).json({ error: 'Invalid Slack webhook URL format' });
  }

  try {
    const response = await fetch(slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: '✅ RespawnSignal Notification Test',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*RespawnSignal Notifications* 🎉\n\nYour Slack integration is working perfectly! You\'ll now receive notifications for:\n• Scan completions with deals\n• Low credit warnings\n• Group scan results',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '_Test sent at ' + new Date().toLocaleTimeString() + '_',
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack API error: ${response.status} - ${text}`);
    }

    res.json({ success: true, message: 'Test message sent to Slack' });
  } catch (err) {
    console.error('POST /api/notifications/test-slack error:', err);
    res.status(500).json({ error: err.message || 'Failed to send test message' });
  }
});

// GET /api/notifications/history - Get notification log
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('notifications_log')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      logs: logs || [],
      total: logs?.length || 0,
    });
  } catch (err) {
    console.error('GET /api/notifications/history error:', err);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

module.exports = router;
