// YouTube Data API v3 wrapper
// Handles: channel resolution, video listing, description extraction

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;

const VALID_SCAN_DEPTHS = [10, 20, 30];
const DEFAULT_SCAN_DEPTH = 10;

/**
 * Resolve a YouTube channel URL, handle, or ID to a canonical channel ID.
 * Accepts:
 * - https://www.youtube.com/@handle
 * - https://www.youtube.com/channel/UCxxxxxx
 * - @handle
 * - UCxxxxxx (raw channel ID)
 */
async function resolveChannelId(input) {
  const trimmed = input.trim();

  // Match channel ID in URL
  const channelUrlMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (channelUrlMatch) return channelUrlMatch[1];

  // Match handle in URL or standalone
  const handleMatch = trimmed.match(/(?:youtube\.com\/)?@([\w.-]+)/);
  const handle = handleMatch ? handleMatch[1] : null;

  // If it looks like a channel ID, return it
  if (!handle && trimmed.startsWith('UC')) return trimmed;

  if (!handle) {
    throw new Error(`Could not parse YouTube channel from input: "${input}"`);
  }

  // Use forHandle to resolve @handle to channel ID
  const url = new URL(`${YOUTUBE_API_BASE}/channels`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('forHandle', handle);
  url.searchParams.set('part', 'id,snippet');

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`YouTube API error resolving handle: ${data.error?.message || res.status}`);
  }

  if (!data.items?.length) {
    throw new Error(`No YouTube channel found for @${handle}`);
  }

  return data.items[0].id;
}

/**
 * Fetch channel metadata (name, subscriber count, thumbnail, etc.)
 */
async function getChannelMetadata(channelId) {
  const url = new URL(`${YOUTUBE_API_BASE}/channels`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('id', channelId);
  url.searchParams.set('part', 'snippet,statistics');

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`YouTube API error fetching channel: ${data.error?.message || res.status}`);
  }

  if (!data.items?.length) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const ch = data.items[0];
  return {
    channelId,
    title: ch.snippet.title,
    handle: ch.snippet.customUrl || null,
    thumbnailUrl: ch.snippet.thumbnails?.medium?.url || null,
    subscriberCount: parseInt(ch.statistics.subscriberCount || '0', 10),
    videoCount: parseInt(ch.statistics.videoCount || '0', 10),
    viewCount: parseInt(ch.statistics.viewCount || '0', 10),
  };
}

/**
 * Fetch the most recent N videos from a channel's uploads playlist.
 * YouTube uploads playlist ID = swap UC prefix to UU.
 */
async function getRecentVideos(channelId, maxResults) {
  const uploadsPlaylistId = 'UU' + channelId.slice(2);

  const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('playlistId', uploadsPlaylistId);
  url.searchParams.set('part', 'snippet,contentDetails');
  url.searchParams.set('maxResults', String(Math.min(maxResults, 50)));

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`YouTube API error fetching videos: ${data.error?.message || res.status}`);
  }

  return (data.items || []).map((item) => ({
    videoId: item.contentDetails.videoId,
    title: item.snippet.title,
    publishedAt: item.contentDetails.videoPublishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url || null,
  }));
}

/**
 * Fetch full video details including complete descriptions.
 * Batches up to 50 IDs per request automatically.
 */
async function getVideoDetails(videoIds) {
  if (!videoIds.length) return [];

  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  const results = [];

  for (const chunk of chunks) {
    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('id', chunk.join(','));
    url.searchParams.set('part', 'snippet,statistics');

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok) {
      throw new Error(`YouTube API error fetching video details: ${data.error?.message || res.status}`);
    }

    for (const item of data.items || []) {
      results.push({
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        viewCount: parseInt(item.statistics.viewCount || '0', 10),
        likeCount: parseInt(item.statistics.likeCount || '0', 10),
        thumbnailUrl: item.snippet.thumbnails?.medium?.url || null,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        tags: item.snippet.tags || [],
      });
    }
  }

  return results;
}

/**
 * Main entry point.
 * scanDepth: 10 | 20 | 30 — how many recent videos to analyze.
 * Invalid values fall back to DEFAULT_SCAN_DEPTH (10).
 */
async function fetchChannelData(channelInput, scanDepth = DEFAULT_SCAN_DEPTH) {
  const depth = VALID_SCAN_DEPTHS.includes(Number(scanDepth))
    ? Number(scanDepth)
    : DEFAULT_SCAN_DEPTH;

  const channelId = await resolveChannelId(channelInput);

  const [metadata, recentVideos] = await Promise.all([
    getChannelMetadata(channelId),
    getRecentVideos(channelId, depth),
  ]);

  const videoIds = recentVideos.map((v) => v.videoId);
  const videoDetails = await getVideoDetails(videoIds);

  const detailMap = Object.fromEntries(videoDetails.map((v) => [v.videoId, v]));
  const videos = recentVideos.map((v) => ({
    ...v,
    ...(detailMap[v.videoId] || {}),
  }));

  return {
    channel: metadata,
    videos,
    videosScanned: videos.length,
    scanDepth: depth,
  };
}

module.exports = {
  fetchChannelData,
  resolveChannelId,
  getChannelMetadata,
  getRecentVideos,
  getVideoDetails,
  VALID_SCAN_DEPTHS,
  DEFAULT_SCAN_DEPTH,
};
