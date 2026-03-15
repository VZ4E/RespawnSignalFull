const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// POST /api/scan
router.post('/', authMiddleware, async (req, res) => {
  const rawUsername = req.body.username;
  if (!rawUsername) return res.status(400).json({ error: 'Username required' });
  const username = rawUsername.trim().replace(/^@/, '').toLowerCase();
  const { range } = req.body;

  const { dbUser, planConfig } = req;

  // Block if no plan
  if (!dbUser.plan || dbUser.plan === 'none') {
    return res.status(403).json({ error: 'No active plan. Please subscribe to start scanning.' });
  }

  // Check credits
  if (dbUser.credits_remaining <= 0) {
    return res.status(402).json({ error: 'No credits remaining. Your monthly credits have been used up.' });
  }

  // Enforce range limit by plan
  const safeRange = Math.min(parseInt(range) || 3, planConfig.maxRange);

  // Check for existing scan (same username + range) — return cached, no credit deduction
  const { data: existing } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', dbUser.id)
    .eq('username', username)
    .eq('range', safeRange)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return res.json({
      videos: [],
      deals: existing.deals || [],
      creditsUsed: 0,
      cached: true,
      cachedAt: existing.created_at,
    });
  }

  // 1. Fetch TikTok videos
  let videos = [];
  try {
    const ttResp = await fetch(
      `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(username)}&count=${safeRange}`,
      {
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY,
          'x-rapidapi-host': 'tiktok-scraper7.p.rapidapi.com',
        },
      }
    );
    const ttData = await ttResp.json();

    let items = [];
    if (Array.isArray(ttData?.data?.videos)) items = ttData.data.videos;
    else if (Array.isArray(ttData?.data?.itemList)) items = ttData.data.itemList;
    else if (Array.isArray(ttData?.data)) items = ttData.data;
    else if (Array.isArray(ttData?.result)) items = ttData.result;
    else if (Array.isArray(ttData?.videos)) items = ttData.videos;
    else if (Array.isArray(ttData?.itemList)) items = ttData.itemList;
    else if (ttData?.data && typeof ttData.data === 'object') {
      const found = Object.values(ttData.data).find(v => Array.isArray(v) && v.length > 0);
      if (found) items = found;
    }

    videos = items.slice(0, safeRange);

    if (!videos.length) {
      const apiMsg = ttData?.message || ttData?.msg || ttData?.error || '';
      return res.status(404).json({ error: `No videos found for @${username}${apiMsg ? ' — ' + apiMsg : '. Check username or account privacy.'}` });
    }
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch TikTok videos: ' + err.message });
  }

  // 2. Transcribe each video
  const withTranscripts = [];
  let totalCredits = 0;
  let transcriptFailures = 0;

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const videoId = v.video_id || v.id || v.aweme_id;
    const title = v.title || v.desc || `Video ${i + 1}`;

    let transcript = '';
    let transcribed = false;
    try {
      const tr = await fetch('https://api.transcript24.com/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TRANSCRIPT24_TOKEN}`,
        },
        body: JSON.stringify({ url: `https://www.tiktok.com/@${username}/video/${videoId}` }),
      });
      const td = await tr.json();
      if (td?.caption && Array.isArray(td.caption)) {
        transcript = td.caption.map(c => c.text).join(' ');
        totalCredits += td.taskCredits || 1;
        transcribed = true;
      }
    } catch (err) {
      console.error(`Transcript24 failed for video ${videoId}:`, err.message);
    }

    if (!transcript) {
      transcriptFailures++;
      transcript = v.title || v.desc || '';
      const tags = (v.text_extra || []).map(t => t.hashtag_name).filter(Boolean).join(' ');
      if (tags) transcript += ' ' + tags;
      totalCredits += 1;
    }

    withTranscripts.push({
      title,
      videoId,
      transcript,
      views: v.play_count || v.statistics?.playCount || 0,
    });
  }

  // 3. Analyze with Perplexity
  let deals = [];
  let analysisError = false;
  try {
    // Cap each transcript at 800 chars to avoid truncating later videos
    const text = withTranscripts
      .map((v, i) => `[Video ${i + 1}: "${v.title}"]\n${v.transcript.slice(0, 800)}`)
      .join('\n\n---\n\n');

    const prompt = `You are an expert at identifying brand deals, sponsorships, and paid partnerships in social media content.

Analyze the following TikTok video transcript(s) and identify ALL brand deals, sponsorships, paid promotions, or affiliate partnerships. When in doubt, include it.

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
- "evidence": exact quote or phrase from transcript
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
        model: 'sonar',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.4,
      }),
    });
    const ppData = await ppResp.json();
    const raw = ppData?.choices?.[0]?.message?.content || '[]';
    deals = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    console.error('Perplexity error:', e.message);
    deals = [];
    analysisError = true;
  }

  // 4. Only deduct credits if we actually transcribed something
  const creditsToDeduct = totalCredits > 0 ? Math.min(totalCredits, dbUser.credits_remaining) : 0;
  if (creditsToDeduct > 0) {
    await supabase
      .from('users')
      .update({ credits_remaining: dbUser.credits_remaining - creditsToDeduct })
      .eq('id', dbUser.id);
  }

  // 5. Save scan record
  await supabase.from('scans').insert({
    user_id: dbUser.id,
    username,
    range: safeRange,
    video_count: videos.length,
    credits_used: creditsToDeduct,
    deals,
  });

  return res.json({
    videos: withTranscripts,
    deals,
    creditsUsed: creditsToDeduct,
    analysisError,
    transcriptFailures,
  });
});

// POST /api/scan/delete-cache — force fresh scan by removing cached entry
router.post('/delete-cache', authMiddleware, async (req, res) => {
  const { username, range } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  await supabase
    .from('scans')
    .delete()
    .eq('user_id', req.dbUser.id)
    .eq('username', username)
    .eq('range', parseInt(range) || 3);
  return res.json({ success: true });
});

// GET /api/scans
router.get('/', authMiddleware, async (req, res) => {
  const { dbUser, planConfig } = req;

  console.log('GET /api/scans — user_id:', dbUser.id, 'email:', dbUser.email);

  let query = supabase
    .from('scans')
    .select('*')
    .eq('user_id', dbUser.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (!planConfig.unlimitedHistory) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', thirtyDaysAgo);
  }

  const { data, error } = await query;
  console.log('scans result — count:', data?.length, 'error:', error);
  if (error) return res.status(500).json({ error: 'Failed to fetch scans' });

  return res.json(data || []);
});

module.exports = router;
