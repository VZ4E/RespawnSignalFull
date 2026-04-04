const fetch = require('node-fetch');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if yt-dlp is available on startup
exec('yt-dlp --version', (err, stdout) => {
  console.log('[TwitchTranscriber] yt-dlp version:', stdout.trim() || err?.message);
});

async function downloadTwitchAudio(m3u8Url, vodId) {
  const outputPath = `/tmp/twitch_${vodId}.mp3`;
  console.log(`[TwitchTranscriber] Downloading audio to ${outputPath}`);

  return new Promise((resolve, reject) => {
    exec(`yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" "${m3u8Url}" --no-playlist`,
      { timeout: 300000 }, // 5 min timeout
      (error, stdout, stderr) => {
        if (error) {
          console.error('[TwitchTranscriber] yt-dlp error:', stderr);
          reject(error);
        } else {
          console.log('[TwitchTranscriber] Download complete');
          resolve(outputPath);
        }
      }
    );
  });
}

async function getTwitchVodTranscript(vodId) {
  const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;
  const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

  console.log('[TwitchTranscriber] API key loaded:', ASSEMBLYAI_KEY ? 'YES' : 'MISSING');
  console.log('[TwitchTranscriber] Twitch credentials loaded:',
    TWITCH_CLIENT_ID ? 'CLIENT_ID=YES' : 'CLIENT_ID=MISSING',
    TWITCH_CLIENT_SECRET ? 'CLIENT_SECRET=YES' : 'CLIENT_SECRET=MISSING'
  );

  // Step 0 — Get fresh Twitch app access token
  console.log('[TwitchTranscriber] Requesting fresh access token...');
  const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  const tokenData = await tokenResp.json();
  const accessToken = tokenData.access_token;
  console.log('[TwitchTranscriber] Fresh token obtained:', accessToken ? 'YES' : 'FAILED', tokenData.error || '');

  if (!accessToken) {
    console.error('[TwitchTranscriber] Failed to obtain access token:', tokenData);
    return null;
  }

  console.log(`[TwitchTranscriber] Fetching VOD info for ID: ${vodId}`);

  // Step 1 — Get VOD info from Twitch API
  const vodResp = await fetch(`https://api.twitch.tv/helix/videos?id=${vodId}`, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Authorization': `Bearer ${accessToken}`
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

  // Step 3 — Download audio from m3u8 URL
  let audioPath;
  try {
    audioPath = await downloadTwitchAudio(m3u8Url, vodId);
  } catch (error) {
    console.error('[TwitchTranscriber] Download failed:', error.message);
    return null;
  }

  // Step 4 — Upload audio file to AssemblyAI
  console.log('[TwitchTranscriber] Uploading audio to AssemblyAI...');
  const fileData = fs.readFileSync(audioPath);
  const uploadResp = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_KEY,
      'Content-Type': 'application/octet-stream'
    },
    body: fileData
  });
  const uploadData = await uploadResp.json();
  const uploadUrl = uploadData.upload_url;
  console.log('[TwitchTranscriber] Uploaded to AssemblyAI:', uploadUrl ? 'YES' : 'FAILED');

  if (!uploadUrl) {
    console.error('[TwitchTranscriber] Upload failed:', uploadData);
    fs.unlinkSync(audioPath);
    return null;
  }

  // Clean up local file
  fs.unlinkSync(audioPath);
  console.log('[TwitchTranscriber] Local file cleaned up');

  // Step 5 — Submit uploadUrl to AssemblyAI for transcription
  const submitResp = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
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

  // Step 6 — Poll until complete
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
