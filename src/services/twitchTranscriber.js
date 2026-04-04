const fetch = require('node-fetch');

const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;

async function getTwitchVodTranscript(vodUrl) {
  console.log(`[TwitchTranscriber] Starting transcript for: ${vodUrl}`);

  // Step 1 — Submit VOD URL to AssemblyAI
  const submitResp = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      'Authorization': ASSEMBLYAI_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: vodUrl,
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

  // Step 2 — Poll until complete
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
