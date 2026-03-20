const axios = require('axios');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Scan Twitch channel for brand deals in stream titles/descriptions
 * @param {string} handle - Twitch username (e.g., linustechtips)
 * @param {number} scanDepth - Number of recent streams to scan (3, 14, or 30)
 * @returns {Promise<Object>} Scan results with detected deals and metadata
 */
async function scanTwitchChannel(handle, scanDepth = 30) {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY environment variable not set');
  }

  if (!TWITCH_CLIENT_ID || !TWITCH_ACCESS_TOKEN) {
    throw new Error('Twitch credentials (TWITCH_CLIENT_ID, TWITCH_ACCESS_TOKEN) not configured');
  }

  // Normalize handle: remove @ if present
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  try {
    // TODO: Fetch recent streams from Twitch API
    // For now, return placeholder response
    return {
      success: true,
      channel_handle: cleanHandle,
      channel_name: cleanHandle,
      channel_thumbnail: null,
      subscriber_count: 0,
      scan_depth: scanDepth,
      streams_scanned: 0,
      deals_found: [],
      brands_detected: [],
      keywords_matched: [],
    };
  } catch (error) {
    throw new Error(`Failed to scan Twitch channel: ${error.message}`);
  }
}

module.exports = {
  scanTwitchChannel,
};
