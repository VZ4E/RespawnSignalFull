const fetch = require('node-fetch');

async function getTwitchVodTranscript(vodId) {
  const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;
  const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;

  console.log('[TwitchTranscriber] API key loaded:', ASSEMBLYAI_KEY ? 'YES' : 'MISSING');
  console.log('[TwitchTranscriber] Twitch credentials loaded:', (TWITCH_CLIENT_ID && TWITCH_ACCESS_TOKEN) ? 'YES' : 'MISSING');
  console.log(`[TwitchTranscriber] Fetching VOD info for ID: ${vodId}`);

  // Step 1 — Get VOD info from Twitch API
  const vodResp = await fetch(`https://api.twitch.tv/helix/videos?id=${vodId}`, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${TWITCH_ACCESS_TOKEN}`
    }
  });
  const vodData = await vodResp.json();
  console.log('[TwitchTranscriber] VOD data:', JSON.stringify(vodData).substring(0, 300));

  // Step 2 — Extract m3u8 URL from VOD data
  const vod = vodData?.data?.[0];
  if (!vod) {
    console.error('[TwitchTranscriber] VOD not found');
    return null;
  }

  // Build m3u8 URL from thumbnail URL
  const thumbUrl = vod.thumbnail_url;
  const baseUrl = thumbUrl.replace('%{width}x%{height}', '320x180').replace('/thumb/thumb0-320x180.jpg', '');
  const m3u8Url = `${baseUrl}/chunked/index-dvr.m3u8`;
  console.log(`[TwitchTranscriber] m3u8 URL: ${m3u8Url}`);

  // Step 3 — Submit m3u8 URL to AssemblyAI
  const submitResp = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: m3u8Url,
      speech_models: ['universal-2'],
      language_code: 'en',
      punctuate: true,
      format_text: true
    })
  });

  const submitData = await submitResp.json();
  const transcriptId = submitData.id;
  console.log(`[TwitchTranscriber] Submitted — transcript ID: ${transcriptId}`);

  if (!transcriptId) {
    console.error('[TwitchTranscriber] Submit failed:', submitData);
    return null;
  }

  // Step 4 — Poll until complete
  const pollUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  let attempts = 0;
  const maxAttempts = 120; // 10 minutes max (5 second intervals)

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000)); // wait 5 seconds
    attempts++;

    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': ASSEMBLYAI_KEY }
    });
    const pollData = await pollResp.json();

    console.log(`[TwitchTranscriber] Poll ${attempts}: status = ${pollData.status}`);

    if (pollData.status === 'completed') {
      console.log(`[TwitchTranscriber] Transcript complete — ${pollData.text.length} chars`);
      return pollData.text;
    }

    if (pollData.status === 'error') {
      console.error('[TwitchTranscriber] AssemblyAI error:', pollData.error);
      return null;
    }
  }

  console.error('[TwitchTranscriber] Timed out after 10 minutes');
  return null;
}

module.exports = { getTwitchVodTranscript };
