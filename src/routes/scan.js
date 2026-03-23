const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// POST /api/scan
router.post('/', authMiddleware, async (req, res) => {
  // Support both old (username) and new (platform, handle) formats
  let username = req.body.username;
  let platform = req.body.platform || 'tiktok';
  let handle = req.body.handle;
  
  if (!username && !handle) {
    return res.status(400).json({ error: 'Username or handle required' });
  }
  
  // If handle provided, use it; otherwise use username
  if (handle) {
    username = handle.trim().replace(/^@/, '').toLowerCase();
  } else {
    username = username.trim().replace(/^@/, '').toLowerCase();
  }
  
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
  // BUT: Skip cache for group scans (groupId param means this is a bulk scan, always run fresh)
  const { groupId } = req.body;
  
  if (!groupId) {
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
      console.log(`[Scan] Cache hit for ${username}`);
      return res.json({
        videos: [],
        deals: existing.deals || [],
        creditsUsed: 0,
        cached: true,
        cachedAt: existing.created_at,
      });
    }
  } else {
    console.log(`[Scan] Group scan (groupId: ${groupId}) — skipping cache, running fresh`);
  }

  // 1. Fetch videos (TikTok or Twitch)
  let videos = [];
  try {
    if (platform === 'twitch') {
      // Fetch from Twitch (VODs) using Twitch Scraper 2.0 API
      console.log(`[Scan] Fetching Twitch videos for ${username}`);
      
      try {
        const twitchUrl = `https://twitch-scraper2.p.rapidapi.com/api/channels/videos?channel=${encodeURIComponent(username)}&limit=${safeRange}`;
        console.log(`[Scan] Twitch API URL: ${twitchUrl}`);
        console.log(`[Scan] Using RapidAPI key: ${process.env.RAPIDAPI_KEY ? process.env.RAPIDAPI_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
        
        const twitchResp = await fetch(twitchUrl, {
          headers: {
            'x-rapidapi-key': process.env.RAPIDAPI_KEY,
            'x-rapidapi-host': 'twitch-scraper2.p.rapidapi.com',
          },
        });
        
        console.log(`[Scan] Twitch API response status: ${twitchResp.status}`);
        const twitchData = await twitchResp.json();
        console.log(`[Scan] Twitch API full response:`, JSON.stringify(twitchData));

        let items = [];
        if (Array.isArray(twitchData?.data?.user?.videos)) {
          console.log(`[Scan] Found videos in twitchData.data.user.videos`);
          items = twitchData.data.user.videos;
        } else if (Array.isArray(twitchData?.data)) {
          console.log(`[Scan] Found videos in twitchData.data`);
          items = twitchData.data;
        } else if (Array.isArray(twitchData?.videos)) {
          console.log(`[Scan] Found videos in twitchData.videos`);
          items = twitchData.videos;
        } else if (Array.isArray(twitchData?.result)) {
          console.log(`[Scan] Found videos in twitchData.result`);
          items = twitchData.result;
        } else if (Array.isArray(twitchData)) {
          console.log(`[Scan] twitchData is directly an array`);
          items = twitchData;
        } else if (twitchData?.data && typeof twitchData.data === 'object') {
          const found = Object.values(twitchData.data).find(v => Array.isArray(v) && v.length > 0);
          if (found) {
            console.log(`[Scan] Found array in twitchData.data object`);
            items = found;
          }
        }

        console.log(`[Scan] Parsed ${items.length} videos from Twitch API`);
        videos = items.slice(0, safeRange);

        if (!videos.length) {
          const apiMsg = twitchData?.message || twitchData?.msg || twitchData?.error || '';
          console.log(`[Scan] No videos found. API message: ${apiMsg}`);
          return res.status(404).json({ error: `No Twitch videos found for @${username}${apiMsg ? ' — ' + apiMsg : '. Check username or channel privacy.'}` });
        }
      } catch (twitchErr) {
        console.error(`[Scan] Twitch API error:`, twitchErr.message);
        return res.status(502).json({ error: `Failed to fetch Twitch videos: ` + twitchErr.message });
      }
    } else {
      // Default to TikTok
      console.log(`[Scan] Fetching TikTok videos for ${username}`);
      
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
    }
  } catch (err) {
    const platformName = platform === 'twitch' ? 'Twitch' : 'TikTok';
    return res.status(502).json({ error: `Failed to fetch ${platformName} videos: ` + err.message });
  }

  // 2. Transcribe each video
  const withTranscripts = [];
  let totalCredits = 0;
  let transcriptFailures = 0;

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    // Handle both Twitch (node.id) and TikTok (video_id, id, aweme_id) formats
    const videoId = v.node?.id || v.video_id || v.id || v.aweme_id;
    const title = v.node?.title || v.title || v.desc || `Video ${i + 1}`;

    let transcript = '';
    let transcribed = false;
    try {
      // Build the correct URL based on platform
      let videoUrl;
      if (platform === 'twitch') {
        videoUrl = `https://www.twitch.tv/videos/${videoId}`;
      } else {
        videoUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;
      }

      // Use TranscriptHQ for Twitch, Transcript24 for TikTok
      if (platform === 'twitch') {
        console.log(`[Transcribe] Submitting Twitch VOD to TranscriptHQ for ${videoId}`);
        const tr = await fetch('https://api.transcripthq.io/v1/transcripts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.TRANSCRIPTHQ_KEY,
          },
          body: JSON.stringify({ 
            service_type: 'twitch',
            videos: [videoId]
          }),
        });
        console.log(`[Transcribe] TranscriptHQ submission status: ${tr.status}`);
        const td = await tr.json();
        console.log(`[Transcribe] TranscriptHQ response:`, JSON.stringify(td).substring(0, 500));
        
        // TranscriptHQ is async: 202 means job submitted, poll poll_url for results
        // For now, fall back to title-only (users can review full transcripts later via poll_url if needed)
        if (tr.status === 202 && td?.poll_url) {
          console.log(`[Transcribe] ⏳ Job queued (async): ${td.poll_url}`);
          console.log(`[Transcribe] Job ID: ${td.job_id} — will complete in background`);
          // Don't block the scan; use title-only fallback
        } else if (td?.transcripts && Array.isArray(td.transcripts) && td.transcripts[0]) {
          // Completed/instant response
          transcript = td.transcripts[0].text || td.transcripts[0].transcript || td.transcripts[0].content || '';
          totalCredits += td.transcripts[0].credits || 1;
          if (transcript) {
            transcribed = true;
            console.log(`[Transcribe] ✓ Transcribed via TranscriptHQ: ${transcript.length} chars`);
          }
        } else if (td?.text) {
          transcript = td.text;
          totalCredits += 1;
          transcribed = true;
        } else if (td?.transcript) {
          transcript = td.transcript;
          totalCredits += 1;
          transcribed = true;
        } else if (td?.content) {
          transcript = td.content;
          totalCredits += 1;
          transcribed = true;
        } else if (Array.isArray(td) && td[0]) {
          // Direct array response
          transcript = td[0].text || td[0].transcript || td[0].content || '';
          totalCredits += td[0].credits || 1;
          if (transcript) transcribed = true;
        } else if (tr.status !== 202) {
          // Not async, and no transcript — log error
          console.error(`[Transcribe] TranscriptHQ returned unexpected format (status ${tr.status}):`, JSON.stringify(td).substring(0, 300));
        }
      } else {
        // Use Transcript24 for TikTok
        const tr = await fetch('https://api.transcript24.com/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.TRANSCRIPT24_TOKEN}`,
          },
          body: JSON.stringify({ url: videoUrl }),
        });
        const td = await tr.json();
        if (td?.caption && Array.isArray(td.caption)) {
          transcript = td.caption.map(c => c.text).join(' ');
          totalCredits += td.taskCredits || 1;
          transcribed = true;
        }
      }
    } catch (err) {
      console.error(`Transcription failed for video ${videoId}:`, err.message);
    }

    if (!transcript) {
      transcriptFailures++;
      // Only use title/description, NOT hashtags (they shouldn't be analyzed for deals)
      transcript = v.title || v.desc || '';
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

    const platformLabel = platform === 'twitch' ? 'Twitch' : 'TikTok';
    const prompt = `You are an expert at identifying brand deals, sponsorships, and paid partnerships in social media content.

Analyze the following ${platformLabel} video transcript(s) and identify ALL brand deals, sponsorships, paid promotions, or affiliate partnerships. When in doubt, include it.

IMPORTANT: Ignore hashtags (#word). Only analyze the actual spoken content or description text.

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
    const ppData = await ppResp.json();
    const raw = ppData?.choices?.[0]?.message?.content || '[]';
    console.log('Perplexity raw response:', raw.substring(0, 300));
    
    try {
      const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      deals = Array.isArray(parsed) ? parsed : (parsed.deals || []);
      console.log('Parsed deals count:', deals.length);
    } catch (parseErr) {
      console.error('Perplexity JSON parse failed:', parseErr.message, 'Raw:', raw.substring(0, 200));
      deals = [];
      analysisError = true;
    }
  } catch (e) {
    console.error('Perplexity API error:', e.message);
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

  // 5. Save scan record with video list + transcripts for re-analysis
  const videosList = withTranscripts.map(v => ({
    title: v.title,
    videoId: v.videoId,
    desc: v.title,
    transcript: v.transcript,
    views: v.views,
  }));
  
  const { error: insertError } = await supabase.from('scans').insert({
    user_id: dbUser.id,
    username,
    platform: platform || 'tiktok', // ← Save platform for context
    range: safeRange,
    video_count: videos.length,
    credits_used: creditsToDeduct,
    deals,
    videos: videosList,
  });

  if (insertError) {
    console.error('[Scan] Insert error:', insertError.message);
  } else {
    console.log(`[Scan] ✓ Saved ${platform} scan for ${username} with ${deals.length} deals`);
  }

  return res.json({
    videos: withTranscripts,
    deals,
    creditsUsed: creditsToDeduct,
    analysisError,
    transcriptFailures,
  });
});

// POST /api/scan/analyze-video — re-analyze a single video from past scan
router.post('/analyze-video', authMiddleware, async (req, res) => {
  const { username, videoIndex, range } = req.body;
  if (!username || videoIndex === undefined) {
    return res.status(400).json({ error: 'Username and videoIndex required' });
  }

  try {
    // Fetch the scan record to get the video and transcript
    const { data: scan } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', req.dbUser.id)
      .eq('username', username.toLowerCase().replace(/^@/, ''))
      .eq('range', parseInt(range) || 3)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const videos = scan.videos || [];
    if (!videos[videoIndex]) {
      return res.status(404).json({ error: 'Video not found in scan' });
    }

    const video = videos[videoIndex];
    const transcript = video.transcript || '';

    if (!transcript) {
      return res.json({ deals: [] });
    }

    // Re-run Perplexity analysis on this single video
    const analysisResp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.PERPLEXITY_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{
          role: 'user',
          content: `Analyze this social media transcript for brand deals, sponsorships, affiliate links, and paid partnerships. IMPORTANT: Ignore hashtags (#word). Only analyze actual spoken content or description text.\n\n"${transcript}"\n\nRespond ONLY with valid JSON (no markdown): {"deals": [{"brands": ["Brand"], "deal_type": "sponsorship|affiliate|discount", "confidence": "high|medium|low", "evidence": "quote"}]}. If no deals, return {"deals": []}.`
        }],
        temperature: 0.3,
        max_tokens: 3000
      })
    });

    if (!analysisResp.ok) {
      console.error('Perplexity API error:', analysisResp.status, analysisResp.statusText);
      return res.json({ deals: [] });
    }

    const analysisData = await analysisResp.json();
    const content = analysisData.choices?.[0]?.message?.content || '';
    
    console.log('Perplexity raw response:', content.substring(0, 200));

    let deals = [];
    try {
      // Strip markdown if present
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      deals = Array.isArray(parsed) ? parsed : (parsed.deals || []);
      console.log('Parsed deals:', deals.length);
    } catch(parseErr) {
      console.error('JSON parse failed:', parseErr.message, 'Raw content:', content.substring(0, 300));
      return res.json({ deals: [] }); // Return empty rather than error for re-analysis
    }

    return res.json({ deals });
  } catch(e) {
    console.error('analyze-video error:', e.message);
    return res.status(500).json({ error: 'Failed to re-analyze video' });
  }
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

// POST /api/scan/manual-analyze — analyze a pasted link or transcript
router.post('/manual-analyze', authMiddleware, async (req, res) => {
  const { input, saveToHistory } = req.body;
  if (!input || !input.trim()) {
    return res.status(400).json({ error: 'Input required' });
  }

  let transcript = input.trim();
  let detectedPlatform = 'unknown';

  // Detect platform from URL
  if (transcript.includes('tiktok.com')) {
    detectedPlatform = 'tiktok';
  } else if (transcript.includes('twitch.tv')) {
    detectedPlatform = 'twitch';
  }

  // If it's a TikTok/Twitch URL, try to fetch the video and transcript
  if (transcript.includes('tiktok.com') || transcript.includes('twitch.tv')) {
    try {
      let videoId;
      let istwitch = false;
      if (transcript.includes('tiktok.com')) {
        const urlMatch = transcript.match(/\/video\/(\d+)/);
        videoId = urlMatch ? urlMatch[1] : null;
      } else if (transcript.includes('twitch.tv')) {
        const urlMatch = transcript.match(/\/videos\/(\d+)/);
        videoId = urlMatch ? urlMatch[1] : null;
        istwitch = true;
      }

      if (videoId) {
        // Try to fetch transcript via TranscriptHQ (Twitch) or Transcript24 (TikTok)
        try {
          if (istwitch) {
            console.log(`[Manual] Submitting Twitch transcript to TranscriptHQ for ${videoId}`);
            const tr = await fetch('https://api.transcripthq.io/v1/transcripts', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': process.env.TRANSCRIPTHQ_KEY,
              },
              body: JSON.stringify({ 
                service_type: 'twitch',
                videos: [videoId]
              }),
            });
            const td = await tr.json();
            console.log(`[Manual] TranscriptHQ status: ${tr.status}`);
            
            if (tr.status === 202 && td?.poll_url) {
              console.log(`[Manual] Job queued (async): ${td.poll_url}`);
              // Don't block; continue with user-provided text or title-only fallback
            } else if (td?.transcripts && Array.isArray(td.transcripts) && td.transcripts[0]) {
              transcript = td.transcripts[0].text || td.transcripts[0].transcript || td.transcripts[0].content || '';
            } else if (td?.text) {
              transcript = td.text;
            } else if (td?.transcript) {
              transcript = td.transcript;
            } else if (td?.content) {
              transcript = td.content;
            } else if (Array.isArray(td) && td[0]) {
              transcript = td[0].text || td[0].transcript || td[0].content || '';
            }
          } else {
            const tr = await fetch('https://api.transcript24.com/transcribe', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${process.env.TRANSCRIPT24_TOKEN}`,
              },
              body: JSON.stringify({ url: transcript }),
            });
            const td = await tr.json();
            if (td?.caption && Array.isArray(td.caption)) {
              transcript = td.caption.map(c => c.text).join(' ');
            }
          }
        } catch (txErr) {
          console.error('Transcription failed for manual URL:', txErr.message);
          // Fall through to analysis with URL text only
        }
      }
    } catch (err) {
      console.error('URL parsing failed:', err.message);
      // Fall through to analysis
    }
    
    // If we still only have a URL (content fetch failed), ask user to paste
    if (transcript.includes('tiktok.com') || transcript.includes('twitch.tv')) {
      return res.status(400).json({ error: 'Could not fetch content from URL. Please paste the video description or text directly.' });
    }
  }

  // Analyze with Perplexity — use the full prompt like the main scanner
  try {
    const platformLabel = detectedPlatform === 'twitch' ? 'Twitch' : 'TikTok';
    const prompt = `You are an expert at identifying brand deals, sponsorships, and paid partnerships in social media content.

Analyze the following ${platformLabel} video transcript and identify ALL brand deals, sponsorships, paid promotions, or affiliate partnerships. When in doubt, include it.

IMPORTANT: Ignore hashtags (#word). Only analyze actual spoken content or description text.

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
- "video_ref": "Manual Input"

Return ONLY a valid JSON array. No markdown, no explanation. Return [] only if there are genuinely zero promotional mentions.

TRANSCRIPT:
${transcript.slice(0, 3000)}`;

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
        temperature: 0.3,
        max_tokens: 3000
      })
    });

    if (!ppResp.ok) {
      console.error('Perplexity API error:', ppResp.status, ppResp.statusText);
      return res.json({ deals: [] });
    }

    const analysisData = await ppResp.json();
    const content = analysisData.choices?.[0]?.message?.content || '';
    
    console.log('Perplexity raw response:', content.substring(0, 200));

    let deals = [];
    try {
      // Strip markdown if present
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      deals = Array.isArray(parsed) ? parsed : (parsed.deals || []);
      console.log('Parsed deals:', deals.length);
    } catch(parseErr) {
      console.error('JSON parse failed:', parseErr.message, 'Raw content:', content.substring(0, 300));
      return res.status(400).json({ error: 'Failed to parse AI response. Response was: ' + content.substring(0, 200) });
    }

    // Consolidate deals from same video into single campaign
    // If multiple brands appear together, ask Perplexity what the overall deal type is
    let consolidatedDeals = deals;
    if (deals.length > 1) {
      try {
        const brandList = deals.flatMap(d => d.brands || []).join(', ');
        const dealTypes = deals.map(d => d.deal_type).join(', ');
        const evidence = deals.map(d => d.evidence).join('\n');
        
        const consolidatePrompt = `You are analyzing multiple brand mentions from the SAME video segment. The brands and their individual deal types are:

Brands: ${brandList}
Individual deal types detected: ${dealTypes}

Evidence from transcript:
${evidence}

These brands all appear in the same video segment. What is the OVERALL/UMBRELLA deal type for this coordinated campaign?

Consider:
- Are these part of ONE coordinated paid sponsorship/campaign?
- Or are they genuinely separate promotions?
- Look for patterns: shared CTAs, same giveaway, partner mentions, coordinated timing

Return ONLY a JSON object (no markdown, no explanation):
{
  "overall_deal_type": "Paid Sponsorship" | "Coordinated Campaign" | "Mixed Promotions" | other,
  "reasoning": "1-2 sentence explanation",
  "should_consolidate": true | false
}`;

        const cpResp = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.PERPLEXITY_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'sonar-pro',
            messages: [
              { role: 'system', content: 'You are a campaign analyst. Output valid JSON only. No markdown.' },
              { role: 'user', content: consolidatePrompt }
            ],
            temperature: 0.4,
            max_tokens: 300
          })
        });

        if (cpResp.ok) {
          const cpData = await cpResp.json();
          const cpContent = cpData.choices?.[0]?.message?.content || '';
          const cleaned = cpContent.replace(/```json\n?|\n?```/g, '').trim();
          
          try {
            const consolidation = JSON.parse(cleaned);
            if (consolidation.should_consolidate) {
              // Merge all deals into one
              consolidatedDeals = [{
                brands: deals.flatMap(d => d.brands || []).filter((v, i, a) => a.indexOf(v) === i), // unique brands
                deal_type: consolidation.overall_deal_type,
                confidence: 'high', // consolidated = high confidence
                evidence: `Coordinated campaign: ${evidence.slice(0, 200)}...`,
                video_ref: 'Manual Input'
              }];
              console.log('Consolidated deals from', deals.length, 'entries into 1 coordinated campaign');
            }
          } catch(e) {
            console.error('Consolidation parse failed, using original deals');
          }
        }
      } catch(e) {
        console.error('Consolidation analysis failed, using original deals:', e.message);
      }
    }

    // Save to history before responding (so DB is ready when frontend refreshes)
    console.log('Manual analysis complete. saveToHistory:', saveToHistory, 'req.dbUser:', !!req.dbUser);
    
    if (saveToHistory && req.dbUser) {
      console.log('Attempting to save manual analysis to DB for user:', req.dbUser.id);
      const videosList = [{
        title: 'Manual Input',
        videoId: 'manual-' + Date.now(),
        desc: 'Manual Link Analysis',
        transcript: transcript.substring(0, 2000),
        views: 0
      }];
      
      console.log('Insert payload:', {
        user_id: req.dbUser.id,
        username: 'manual-analysis',
        platform: detectedPlatform,
        range: 1,
        video_count: 1,
        credits_used: 0,
        deals_count: consolidatedDeals.length,
        videos_count: videosList.length,
      });
      
      const { data, error: saveErr } = await supabase.from('scans').insert({
        user_id: req.dbUser.id,
        username: 'manual-analysis',
        platform: detectedPlatform,
        range: 1,
        video_count: 1,
        credits_used: 0,
        deals: consolidatedDeals,
        videos: videosList,
      }).select();
      
      if (saveErr) {
        console.error('❌ Failed to save manual analysis:', saveErr);
        // If it's a schema issue, return 500 and still show deals but mention DB is broken
        if (saveErr.code === 'PGRST204' || saveErr.message?.includes('schema cache')) {
          console.error('Schema cache error — videos column likely missing from DB');
          return res.status(500).json({ 
            deals: consolidatedDeals, 
            saveError: 'Database schema error: videos column missing. Please contact support.',
            errorCode: 'SCHEMA_MISSING_VIDEOS'
          });
        }
        return res.status(400).json({ deals: consolidatedDeals, saveError: saveErr.message });
      } else {
        console.log('✅ Manual analysis saved to DB. Inserted rows:', data?.length);
      }
    } else {
      console.log('Skipped save: saveToHistory=' + saveToHistory + ', dbUser=' + !!req.dbUser);
    }

    return res.json({ deals: consolidatedDeals });
  } catch(e) {
    console.error('manual-analyze error:', e.message);
    return res.status(500).json({ error: 'Failed to analyze: ' + e.message });
  }
});

// POST /api/scan/explain-deal — generate AI explanation for a single deal
router.post('/explain-deal', authMiddleware, async (req, res) => {
  const { deal } = req.body;
  if (!deal) {
    return res.status(400).json({ error: 'Deal object required' });
  }

  try {
    const brandsList = (deal.brands || []).join(', ');
    const prompt = `You are a brand deal analyzer. Provide a SHORT (2-3 sentences) explanation of this brand deal:

Brand(s): ${brandsList}
Deal Type: ${deal.deal_type}
Evidence: "${deal.evidence}"

Explain: What is this deal? Which company is involved? What are they promoting? Be concise and direct.`;

    const ppResp = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 150
      })
    });

    if (!ppResp.ok) {
      return res.status(500).json({ error: 'Failed to generate explanation' });
    }

    const ppData = await ppResp.json();
    const explanation = ppData.choices?.[0]?.message?.content || 'Unable to generate explanation.';

    return res.json({ explanation });
  } catch(e) {
    console.error('explain-deal error:', e.message);
    return res.status(500).json({ error: 'Failed to explain deal' });
  }
});

// POST /api/scans/save — explicitly save a completed scan to DB
// Used by frontend to persist scan results immediately after completion
router.post('/save', authMiddleware, async (req, res) => {
  console.log('POST /api/scans/save called');
  const { scan } = req.body;
  
  if (!scan || !scan.label) {
    console.error('Save failed: missing scan or label', { scan });
    return res.status(400).json({ error: 'Scan data required' });
  }

  try {
    console.log('Inserting scan for user', req.dbUser.id, 'username:', scan.label, 'deals:', scan.deals?.length || 0);
    
    const { data, error } = await supabase.from('scans').insert({
      user_id: req.dbUser.id,
      username: scan.label,
      platform: scan.meta?.platform || 'tiktok',
      range: scan.meta?.range || 1,
      video_count: scan.meta?.videoCount || 0,
      credits_used: scan.meta?.credits || 0,
      deals: scan.deals || [],
      videos: scan.videos || [],
    }).select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ error: 'Failed to save scan: ' + error.message });
    }

    console.log('✓ Scan saved successfully. Inserted:', data);
    return res.json({ success: true, inserted: data });
  } catch(e) {
    console.error('Save scan error:', e.message);
    return res.status(500).json({ error: 'Failed to save scan: ' + e.message });
  }
});

// GET /api/scan/recent — fetch recent scans and deals for dashboard
router.get('/recent', authMiddleware, async (req, res) => {
  try {
    const { dbUser } = req;
    
    if (!dbUser || !dbUser.id) {
      console.error('Recent activity: No user in request');
      return res.status(401).json({ error: 'Unauthorized', scans: [], deals: [] });
    }
    
    console.log(`[Recent Activity] Fetching for user ${dbUser.id}`);
    
    // Get last 5-8 scans
    const { data: scans, error: scansError } = await supabase
      .from('scans')
      .select('id, username, platform, created_at, deals')
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: false })
      .limit(8);
    
    if (scansError) {
      console.error('[Recent Activity] Scans query error:', scansError);
      throw scansError;
    }
    
    console.log(`[Recent Activity] Found ${(scans || []).length} scans`);
    
    // Process scans for display
    const processedScans = (scans || []).map(scan => {
      const deals = Array.isArray(scan.deals) ? scan.deals : [];
      return {
        id: scan.id,
        creator_handle: scan.username,
        platform: scan.platform || 'tiktok',
        created_at: scan.created_at,
        deals_count: deals.length
      };
    });
    
    // Get recent deals (last 20 scans, flatten all their deals)
    const { data: dealsRaw, error: dealsError } = await supabase
      .from('scans')
      .select('id, username, platform, deals, created_at')
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (dealsError) {
      console.error('[Recent Activity] Deals query error:', dealsError);
      throw dealsError;
    }
    
    // Flatten deals from scans
    const allDeals = [];
    (dealsRaw || []).forEach(scan => {
      const deals = Array.isArray(scan.deals) ? scan.deals : [];
      deals.forEach(deal => {
        allDeals.push({
          ...deal,
          brand_name: deal.brands?.[0] || deal.brand_name || 'Unknown',
          creator_handle: scan.username,
          platform: scan.platform || 'tiktok',
          created_at: scan.created_at
        });
      });
    });
    
    // Take top 5 deals
    const recentDeals = allDeals.slice(0, 5);
    
    console.log(`[Recent Activity] Returning ${processedScans.length} scans + ${recentDeals.length} deals`);
    
    return res.json({
      scans: processedScans,
      deals: recentDeals
    });
    
  } catch (e) {
    console.error('[Recent Activity] Error:', e.message, e.stack);
    return res.status(500).json({ error: 'Failed to load recent activity: ' + e.message, scans: [], deals: [] });
  }
});

module.exports = router;
