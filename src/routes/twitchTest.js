const express = require('express');
const router = express.Router();
const { getTwitchVodTranscript } = require('../services/twitchTranscriber');

// GET /api/twitch-test?vod=https://www.twitch.tv/videos/2738337586
router.get('/', async (req, res) => {
  const { vod } = req.query;
  if (!vod) return res.status(400).json({ error: 'vod URL or ID required' });

  // Extract VOD ID from URL or use directly
  const vodId = vod.replace('https://www.twitch.tv/videos/', '');
  console.log(`[TwitchTest] Testing VOD ID: ${vodId}`);
  
  const transcript = await getTwitchVodTranscript(vodId);

  if (!transcript) return res.status(500).json({ error: 'Transcript failed' });

  res.json({
    success: true,
    length: transcript.length,
    preview: transcript.substring(0, 500)
  });
});

module.exports = router;
