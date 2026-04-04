const fetch = require('node-fetch');
const { supabase } = require('../supabase');
const nodemailer = require('nodemailer');

/**
 * Compare new deals against last_deals
 * Returns array of new deals (by matching brands + deal_type + evidence)
 */
function findNewDeals(newDeals, lastDeals) {
  if (!Array.isArray(newDeals) || !Array.isArray(lastDeals)) {
    return newDeals || [];
  }

  // Create a "signature" for each deal for comparison
  const lastSigs = lastDeals.map(d => 
    `${(d.brands || []).sort().join('|')}::${d.deal_type}::${d.evidence}`
  );

  return newDeals.filter(d => {
    const sig = `${(d.brands || []).sort().join('|')}::${d.deal_type}::${d.evidence}`;
    return !lastSigs.includes(sig);
  });
}

/**
 * Calculate next_run_at based on frequency
 */
function calculateNextRunAt(frequency) {
  const now = new Date();
  let daysToAdd = 0;

  switch (frequency) {
    case 'twice_weekly':
      daysToAdd = 3.5;
      break;
    case 'weekly':
      daysToAdd = 7;
      break;
    case 'biweekly':
      daysToAdd = 14;
      break;
    case 'monthly':
      daysToAdd = 30;
      break;
    default:
      daysToAdd = 7;
  }

  const nextRun = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return nextRun.toISOString();
}

/**
 * Format a deal for email display
 */
function formatDealForEmail(deal) {
  const brands = (deal.brands || []).join(', ');
  const confidence = deal.confidence || 'unknown';
  const badge = `[${confidence.toUpperCase()}]`;
  return `
    <div style="margin: 12px 0; padding: 10px; background: #f5f5f5; border-left: 4px solid #2563eb; border-radius: 4px;">
      <strong>${brands}</strong> ${badge}
      <br/>
      <small style="color: #666;">Type: ${deal.deal_type || 'Unknown'}</small>
      <br/>
      <em style="color: #888;">"${deal.evidence || 'N/A'}"</em>
    </div>
  `;
}

/**
 * Send email notification
 */
async function sendAutomationEmail(to, subject, newDeals, lastDeals, creatorHandle) {
  try {
    // Configure nodemailer (use Resend or Gmail, depending on env)
    let transporter;
    
    if (process.env.RESEND_API_KEY) {
      // Use Resend
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      console.log(`[AutomationScheduler] Sending email via Resend to ${to}`);
      
      let html = `<h2>${subject}</h2>`;
      
      if (newDeals.length > 0) {
        html += `<p style="color: #10b981; font-weight: bold;">✓ ${newDeals.length} NEW DEAL${newDeals.length > 1 ? 'S' : ''} FOUND:</p>`;
        newDeals.forEach(deal => {
          html += formatDealForEmail(deal);
        });
      } else {
        html += `<p>No new deals found. Here's the current list for @${creatorHandle}:</p>`;
        lastDeals.forEach(deal => {
          html += formatDealForEmail(deal);
        });
      }
      
      html += `<hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <small style="color: #666;">View all automations: <a href="${process.env.APP_URL || 'https://app.respawnsignal.com'}/automation">Automation Center</a></small>`;
      
      const result = await resend.emails.send({
        from: 'Respawn Signal <automations@respawnsignal.com>',
        to,
        subject,
        html,
      });
      
      console.log(`[AutomationScheduler] ✓ Email sent via Resend:`, result);
      return true;
    } else if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      // Use Gmail
      console.log(`[AutomationScheduler] Sending email via Gmail to ${to}`);
      
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS,
        },
      });
      
      let html = `<h2>${subject}</h2>`;
      
      if (newDeals.length > 0) {
        html += `<p style="color: #10b981; font-weight: bold;">✓ ${newDeals.length} NEW DEAL${newDeals.length > 1 ? 'S' : ''} FOUND:</p>`;
        newDeals.forEach(deal => {
          html += formatDealForEmail(deal);
        });
      } else {
        html += `<p>No new deals found. Here's the current list for @${creatorHandle}:</p>`;
        lastDeals.forEach(deal => {
          html += formatDealForEmail(deal);
        });
      }
      
      html += `<hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <small style="color: #666;">View all automations: <a href="${process.env.APP_URL || 'https://app.respawnsignal.com'}/automation">Automation Center</a></small>`;
      
      const result = await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to,
        subject,
        html,
      });
      
      console.log(`[AutomationScheduler] ✓ Email sent via Gmail:`, result.messageId);
      return true;
    } else {
      console.warn('[AutomationScheduler] No email service configured. Skipping email send.');
      return false;
    }
  } catch (err) {
    console.error('[AutomationScheduler] Email send failed:', err.message);
    return false;
  }
}

/**
 * Run a scan for a creator (using same logic as manual scan)
 */
async function runCreatorScan(userId, creatorUsername, platform = 'tiktok', range = 14) {
  try {
    console.log(`[AutomationScheduler] Running scan for @${creatorUsername} (${platform}, range: ${range})`);

    // Get user from auth
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('credits_remaining')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('[AutomationScheduler] Could not fetch user data:', userError?.message);
      return null;
    }

    if (userData.credits_remaining <= 0) {
      console.warn(`[AutomationScheduler] User ${userId} has no credits remaining`);
      return null;
    }

    // Fetch videos from TikTok
    const ttResp = await fetch(
      `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(creatorUsername)}&count=${range}`,
      {
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY,
          'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        },
      }
    );

    if (!ttResp.ok) {
      console.error(`[AutomationScheduler] TikTok API error: ${ttResp.status}`);
      return null;
    }

    const ttData = await ttResp.json();
    let videos = [];

    if (Array.isArray(ttData?.data?.videos)) videos = ttData.data.videos;
    else if (Array.isArray(ttData?.data?.itemList)) videos = ttData.data.itemList;
    else if (Array.isArray(ttData?.data)) videos = ttData.data;
    else if (Array.isArray(ttData?.result)) videos = ttData.result;
    else if (Array.isArray(ttData?.videos)) videos = ttData.videos;

    videos = videos.slice(0, range);

    if (videos.length === 0) {
      console.warn(`[AutomationScheduler] No videos found for @${creatorUsername}`);
      return null;
    }

    // Transcribe videos
    const withTranscripts = videos.map((v, i) => ({
      title: v.title || v.desc || `Video ${i + 1}`,
      videoId: v.video_id || v.id || v.aweme_id,
      transcript: v.desc || v.title || '', // Use description as fallback transcript
      views: v.play_count || 0,
    }));

    // Analyze with Perplexity
    const text = withTranscripts
      .map((v, i) => `[Video ${i + 1}: "${v.title}"]\n${v.transcript.slice(0, 2000)}`)
      .join('\n\n---\n\n');

    const prompt = `You are an expert at identifying brand deals, sponsorships, and paid partnerships in social media content.

Analyze the following ${platform === 'twitch' ? 'Twitch' : 'TikTok'} video transcript(s) and identify ALL brand deals, sponsorships, paid promotions, or affiliate partnerships. When in doubt, include it.

IMPORTANT: Ignore hashtags (#word). Only analyze the actual spoken content or description text.
CRITICAL: Only reference the video transcripts provided below. Do not search the web. Do not cite YouTube or any external source. Label evidence only as Video 1, Video 2, etc.

TYPES TO DETECT (not limited to these):
- Traditional sponsorships ("this video is sponsored by X")
- Affiliate links and discount codes ("use code X for 10% off")
- Product placement or gifted products
- Gaming/app promotions (UEFN maps, Fortnite creative codes, mobile games, apps)
- Brand ambassador mentions
- Merchandise or music promotions paid by a label/brand
- Any "link in bio" or "check out X" that sounds promotional
- Creator fund content for specific platforms

GROUPING RULES:
- Same sentence + same promotion = group in ONE entry with all brand names
- Different parts of video or different sentences = SEPARATE entries
- Default to separate when unsure

Return a JSON array where each object has:
- "brands": string[] — brand/game/app/creator names
- "deal_type": "Paid Sponsorship"|"Affiliate Link"|"Product Placement"|"Brand Ambassador"|"Gifted Product"|"Discount Code"|"Game Promotion"|"App Promotion"|"Unknown"
- "confidence": "high"|"medium"|"low"
- "evidence": exact quote or phrase from transcript (NOT hashtags)
- "video_ref": e.g. "Video 1"

Return ONLY a valid JSON array. No markdown, no explanation. Return [] only if there are genuinely zero promotional mentions.

TRANSCRIPTS:\n${text}`;

    const ppResp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a brand deal detection engine. You only output valid JSON arrays. Never explain your reasoning. Never add markdown. Return [] if no deals found.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.3,
      }),
    });

    if (!ppResp.ok) {
      console.error(`[AutomationScheduler] Perplexity API error: ${ppResp.status}`);
      return null;
    }

    const ppData = await ppResp.json();
    const raw = ppData?.choices?.[0]?.message?.content || '[]';

    let deals = [];
    try {
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      deals = Array.isArray(parsed) ? parsed : (parsed.deals || []);
    } catch (parseErr) {
      console.error('[AutomationScheduler] Perplexity parse failed:', parseErr.message);
      deals = [];
    }

    console.log(`[AutomationScheduler] ✓ Scan complete: ${videos.length} videos, ${deals.length} deals found`);

    return deals;
  } catch (err) {
    console.error('[AutomationScheduler] Scan error:', err.message);
    return null;
  }
}

/**
 * Process a single due automation
 */
async function processAutomation(automation) {
  try {
    console.log(`[AutomationScheduler] Processing automation ${automation.id} for @${automation.creator_username}`);

    // Run scan
    const deals = await runCreatorScan(automation.user_id, automation.creator_username, automation.platform);

    if (deals === null) {
      console.warn(`[AutomationScheduler] Scan returned null, skipping automation ${automation.id}`);
      return;
    }

    // Find new deals
    const newDeals = findNewDeals(deals, automation.last_deals || []);

    // Prepare email subject and send
    const subject = newDeals.length > 0
      ? `New brand deals detected for @${automation.creator_username}`
      : `No new deals for @${automation.creator_username}`;

    const emailSent = await sendAutomationEmail(
      automation.email,
      subject,
      newDeals,
      deals, // Show all deals as "current list"
      automation.creator_username
    );

    if (!emailSent) {
      console.warn(`[AutomationScheduler] Email failed for automation ${automation.id}, but continuing`);
    }

    // Update automation record
    const nextRunAt = calculateNextRunAt(automation.frequency);

    const { error: updateErr } = await supabase
      .from('automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_deals: deals, // Store all deals
        next_run_at: nextRunAt,
      })
      .eq('id', automation.id);

    if (updateErr) {
      console.error(`[AutomationScheduler] Failed to update automation ${automation.id}:`, updateErr.message);
    } else {
      console.log(`[AutomationScheduler] ✓ Automation ${automation.id} processed successfully`);
    }
  } catch (err) {
    console.error(`[AutomationScheduler] Error processing automation ${automation.id}:`, err.message);
  }
}

/**
 * Main scheduler function (called by cron job every hour)
 */
async function runAutomationScheduler() {
  try {
    console.log('[AutomationScheduler] Starting scheduled run...');

    // Fetch all active automations where next_run_at <= NOW
    const { data: automations, error } = await supabase
      .from('automations')
      .select('*')
      .eq('active', true)
      .lte('next_run_at', new Date().toISOString())
      .order('next_run_at', { ascending: true });

    if (error) {
      console.error('[AutomationScheduler] Query error:', error.message);
      return;
    }

    const count = (automations || []).length;
    console.log(`[AutomationScheduler] Found ${count} due automations`);

    if (count === 0) {
      console.log('[AutomationScheduler] No due automations, exiting');
      return;
    }

    // Process each automation sequentially
    for (const automation of automations) {
      await processAutomation(automation);
    }

    console.log(`[AutomationScheduler] ✓ Completed ${count} automations`);
  } catch (err) {
    console.error('[AutomationScheduler] Fatal error:', err.message);
  }
}

module.exports = {
  runAutomationScheduler,
  findNewDeals,
  calculateNextRunAt,
};
