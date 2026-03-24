/**
 * Notification Service
 * Handles sending notifications via Slack, email, and webhooks
 */

const axios = require('axios');
const { supabase } = require('../supabase');

// ──────────────────────────────────────────────────────────
// SLACK NOTIFICATIONS
// ──────────────────────────────────────────────────────────

async function sendSlackNotification(webhookUrl, message, deals = []) {
  if (!webhookUrl) {
    console.log('[Slack] No webhook URL provided, skipping notification');
    return false;
  }

  try {
    // Format message with deal details
    let text = message;
    if (deals.length > 0) {
      text += `\n\n*Found ${deals.length} deal${deals.length !== 1 ? 's' : ''}:*`;
      deals.slice(0, 10).forEach((deal, i) => {
        text += `\n${i + 1}. ${deal.brands?.join(', ') || 'Unknown Brand'} - ${deal.deal_type || 'Unknown Type'}`;
      });
      if (deals.length > 10) {
        text += `\n... and ${deals.length - 10} more`;
      }
    }

    const payload = {
      text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
      ],
    };

    // Add deals block if any deals found
    if (deals.length > 0) {
      payload.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Found ${deals.length} deal${deals.length !== 1 ? 's' : ''}:*\n${deals
            .slice(0, 10)
            .map((d, i) => `${i + 1}. ${d.brands?.join(', ') || 'Unknown'} - ${d.deal_type || 'Unknown'}`)
            .join('\n')}${deals.length > 10 ? `\n... and ${deals.length - 10} more` : ''}`,
        },
      });
    }

    const response = await axios.post(webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('[Slack] Notification sent successfully');
    return true;
  } catch (err) {
    console.error('[Slack] Failed to send notification:', err.message);
    return false;
  }
}

// ──────────────────────────────────────────────────────────
// EMAIL NOTIFICATIONS (Future: integrate with SendGrid/Resend)
// ──────────────────────────────────────────────────────────

async function sendEmailNotification(email, subject, htmlContent) {
  // TODO: Integrate with SendGrid or Resend
  console.log(`[Email] Would send to ${email}: ${subject}`);
  return false;
}

// ──────────────────────────────────────────────────────────
// WEBHOOK NOTIFICATIONS (Generic)
// ──────────────────────────────────────────────────────────

async function sendWebhookNotification(webhookUrl, payload) {
  if (!webhookUrl) {
    console.log('[Webhook] No URL provided, skipping');
    return false;
  }

  try {
    const response = await axios.post(webhookUrl, payload, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    console.log('[Webhook] Sent successfully');
    return true;
  } catch (err) {
    console.error('[Webhook] Failed:', err.message);
    return false;
  }
}

// ──────────────────────────────────────────────────────────
// NOTIFY ON SCAN COMPLETION
// ──────────────────────────────────────────────────────────

async function notifyOnScanComplete(userId, creatorHandle, platform, deals = [], scanId = null) {
  try {
    // Get user's notification preferences
    const { data: user } = await supabase
      .from('users')
      .select('slack_webhook_url, email, notification_on_deals')
      .eq('id', userId)
      .single();

    if (!user) return;

    // Determine if should notify
    const shouldNotify = user.notification_on_deals === true || (user.notification_on_deals === null && deals.length > 0);
    if (!shouldNotify) return;

    const dealsText = deals.length > 0 ? `🎉 Found ${deals.length} deal${deals.length !== 1 ? 's' : ''}!` : '❌ No deals found';
    const message = `*Scan Complete*\n📱 ${platform.toUpperCase()}: @${creatorHandle}\n${dealsText}`;

    // Send Slack if webhook is configured
    if (user.slack_webhook_url) {
      await sendSlackNotification(user.slack_webhook_url, message, deals);
    }

    // Log notification
    await supabase.from('notifications_log').insert({
      user_id: userId,
      type: 'scan_complete',
      platform,
      creator_handle: creatorHandle,
      deals_found: deals.length,
      scan_id: scanId,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[notifyOnScanComplete] Error:', err.message);
  }
}

// ──────────────────────────────────────────────────────────
// NOTIFY ON DEAL FOUND
// ──────────────────────────────────────────────────────────

async function notifyOnDealFound(userId, deal, creatorHandle, platform) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('slack_webhook_url, notification_on_every_deal')
      .eq('id', userId)
      .single();

    if (!user?.slack_webhook_url || !user.notification_on_every_deal) return;

    const brands = (deal.brands || []).join(', ') || 'Unknown Brand';
    const message = `*New Deal Found*\n🎯 ${brands}\n📱 @${creatorHandle} (${platform.toUpperCase()})\n💼 ${deal.deal_type || 'Brand Deal'}`;

    await sendSlackNotification(user.slack_webhook_url, message, [deal]);
  } catch (err) {
    console.error('[notifyOnDealFound] Error:', err.message);
  }
}

// ──────────────────────────────────────────────────────────
// NOTIFY ON LOW CREDITS
// ──────────────────────────────────────────────────────────

async function notifyOnLowCredits(userId, creditsRemaining, creditsLimit = 100) {
  try {
    if (creditsRemaining > creditsLimit) return;

    const { data: user } = await supabase
      .from('users')
      .select('slack_webhook_url, email, plan')
      .eq('id', userId)
      .single();

    if (!user) return;

    const message = `⚠️ *Low Credits Alert*\nYou have ${creditsRemaining} credits remaining on your ${user.plan.toUpperCase()} plan.\nUpgrade or buy a top-up to continue scanning.`;

    if (user.slack_webhook_url) {
      await sendSlackNotification(user.slack_webhook_url, message);
    }
  } catch (err) {
    console.error('[notifyOnLowCredits] Error:', err.message);
  }
}

// ──────────────────────────────────────────────────────────
// GROUP BULK SCAN NOTIFICATIONS
// ──────────────────────────────────────────────────────────

async function notifyOnGroupScanComplete(userId, groupName, results) {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('slack_webhook_url')
      .eq('id', userId)
      .single();

    if (!user?.slack_webhook_url) return;

    const totalDeals = results.reduce((sum, r) => sum + (r.deals || 0), 0);
    const successCount = results.filter((r) => r.status === 'success').length;
    const failedCount = results.filter((r) => r.status === 'failed').length;

    let message = `*Bulk Scan Complete: ${groupName}*\n`;
    message += `✅ ${successCount} successful, ❌ ${failedCount} failed\n`;
    message += `🎯 Found ${totalDeals} total deal${totalDeals !== 1 ? 's' : ''}\n\n`;
    message += `*Summary:*\n`;
    results.slice(0, 5).forEach((r) => {
      message += `• @${r.creator} (${r.platform}): ${r.deals || 0} deal${r.deals !== 1 ? 's' : ''}\n`;
    });
    if (results.length > 5) {
      message += `... and ${results.length - 5} more creators`;
    }

    await sendSlackNotification(user.slack_webhook_url, message);
  } catch (err) {
    console.error('[notifyOnGroupScanComplete] Error:', err.message);
  }
}

module.exports = {
  sendSlackNotification,
  sendEmailNotification,
  sendWebhookNotification,
  notifyOnScanComplete,
  notifyOnDealFound,
  notifyOnLowCredits,
  notifyOnGroupScanComplete,
};
