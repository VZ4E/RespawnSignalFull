const fetch = require('node-fetch');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Check if yt-dlp is available on startup
exec('yt-dlp --version', (err, stdout) => {
  console.log('[TwitchTranscriber] yt-dlp version:', stdout.trim() || err?.message);
});

async function downloadTwitchAudio(vodId) {
  const outputPath = `/tmp/twitch_${vodId}.mp3`;
  const twitchVodUrl = `https://www.twitch.tv/videos/${vodId}`;
  
  console.log(`[TwitchTranscriber] Downloading audio from: ${twitchVodUrl}`);

  return new Promise((resolve, reject) => {
    exec(`yt-dlp -x --audio-format mp3 --audio-quality 5 -o "${outputPath}" "${twitchVodUrl}"`,
      { timeout: 600000 }, // 10 min timeout for long VODs
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

  console.log('[TwitchTranscriber] API key loaded:', ASSEMBLYAI_KEY ? 'YES' : 'MISSING');

  // Step 1 — Download audio directly from Twitch VOD URL using yt-dlp
  let audioPath;
  try {
    audioPath = await downloadTwitchAudio(vodId);
  } catch (error) {
    console.error('[TwitchTranscriber] Download failed:', error.message);
    return null;
  }

  // Step 2 — Upload audio file to AssemblyAI
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

  // Step 3 — Submit uploadUrl to AssemblyAI for transcription
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
