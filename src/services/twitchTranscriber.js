const fetch = require('node-fetch');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_VOD_HOURS = 10;
const SEGMENT_HOURS = 5;

// Check if yt-dlp is available on startup
exec('yt-dlp --version', (err, stdout) => {
  console.log('[TwitchTranscriber] yt-dlp version:', stdout.trim() || err?.message);
});

/**
 * Download a specific segment of a Twitch VOD using yt-dlp's --download-sections
 */
async function downloadSegment(vodUrl, outputPath, startTime, endTime) {
  const timeArg = endTime 
    ? `*${startTime}-${endTime}` 
    : `*${startTime}-inf`;
  
  console.log(`[TwitchTranscriber] Downloading segment ${startTime} → ${endTime || 'end'}`);
  
  return new Promise((resolve, reject) => {
    exec(
      `yt-dlp --download-sections "${timeArg}" -x --audio-format mp3 --audio-quality 5 -o "${outputPath}" "${vodUrl}"`,
      { timeout: 900000, maxBuffer: 1024 * 1024 * 50 }, // 15 min timeout, 50MB buffer
      (error, stdout, stderr) => {
        if (error) {
          console.error(`[TwitchTranscriber] Segment download error:`, stderr?.substring(0, 200));
          reject(error);
        } else {
          console.log(`[TwitchTranscriber] Segment downloaded: ${outputPath}`);
          resolve(outputPath);
        }
      }
    );
  });
}

/**
 * Upload audio file to AssemblyAI and transcribe it
 */
async function uploadAndTranscribe(filePath, ASSEMBLYAI_KEY) {
  // Upload to AssemblyAI
  const fileData = fs.readFileSync(filePath);
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
  
  // Clean up file immediately after upload
  fs.unlinkSync(filePath);
  console.log(`[TwitchTranscriber] Uploaded segment: ${filePath}`);

  if (!uploadUrl) {
    console.error('[TwitchTranscriber] Upload failed:', uploadData);
    throw new Error('Failed to upload segment to AssemblyAI');
  }

  // Submit for transcription
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
  console.log(`[TwitchTranscriber] Segment transcript ID: ${transcriptId}`);

  if (!transcriptId) {
    console.error('[TwitchTranscriber] Submit failed:', submitData);
    throw new Error('Failed to submit segment for transcription');
  }

  // Poll for completion
  const pollUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  let attempts = 0;
  const maxAttempts = 180; // 15 minutes max (5 second intervals)

  while (attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 5000)); // wait 5 seconds
    attempts++;

    const pollResp = await fetch(pollUrl, {
      headers: { 'Authorization': ASSEMBLYAI_KEY }
    });
    const pollData = await pollResp.json();

    console.log(`[TwitchTranscriber] Poll ${attempts}: status = ${pollData.status}`);

    if (pollData.status === 'completed') {
      console.log(`[TwitchTranscriber] Segment transcript complete — ${pollData.text.length} chars`);
      return pollData.text;
    }

    if (pollData.status === 'error') {
      console.error('[TwitchTranscriber] AssemblyAI error:', pollData.error);
      throw new Error(pollData.error);
    }
  }

  throw new Error('Segment transcription timed out after 15 minutes');
}

/**
 * Main function: Download and transcribe Twitch VOD, handling long VODs with segmentation
 */
async function getTwitchVodTranscript(vodId, vodLengthSeconds = 0) {
  const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;
  console.log(`[TwitchTranscriber] API key loaded: ${ASSEMBLYAI_KEY ? 'YES' : 'MISSING'}`);

  if (!ASSEMBLYAI_KEY) {
    console.error('[TwitchTranscriber] Missing ASSEMBLYAI_API_KEY');
    return null;
  }

  const vodUrl = `https://www.twitch.tv/videos/${vodId}`;
  const vodHours = vodLengthSeconds / 3600;

  // Cap at 10 hours max
  if (vodHours > MAX_VOD_HOURS) {
    console.log(`[TwitchTranscriber] VOD is ${vodHours.toFixed(1)}h — capping at ${MAX_VOD_HOURS}h`);
  }

  try {
    // Short VOD (≤5 hours): Single segment
    if (vodHours <= SEGMENT_HOURS) {
      console.log(`[TwitchTranscriber] Short VOD (${vodHours.toFixed(1)}h) — single segment`);
      const outputPath = `/tmp/twitch_${vodId}.mp3`;
      await downloadSegment(vodUrl, outputPath, '00:00:00', null);
      return await uploadAndTranscribe(outputPath, ASSEMBLYAI_KEY);
    }

    // Long VOD (>5 hours): Split into two 5-hour segments in parallel
    console.log(`[TwitchTranscriber] Long VOD (${vodHours.toFixed(1)}h) — splitting into 2 segments`);
    const seg1Path = `/tmp/twitch_${vodId}_seg1.mp3`;
    const seg2Path = `/tmp/twitch_${vodId}_seg2.mp3`;

    const [transcript1, transcript2] = await Promise.all([
      downloadSegment(vodUrl, seg1Path, '00:00:00', '05:00:00')
        .then(() => uploadAndTranscribe(seg1Path, ASSEMBLYAI_KEY)),
      downloadSegment(vodUrl, seg2Path, '05:00:00', '10:00:00')
        .then(() => uploadAndTranscribe(seg2Path, ASSEMBLYAI_KEY))
    ]);

    console.log(`[TwitchTranscriber] Both segments complete — combining transcripts`);
    return `${transcript1}\n\n[SEGMENT 2 - HOURS 5-10]\n\n${transcript2}`;
  } catch (error) {
    console.error('[TwitchTranscriber] Fatal error:', error.message);
    return null;
  }
}

module.exports = { getTwitchVodTranscript };
