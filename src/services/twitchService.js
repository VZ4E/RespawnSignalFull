const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error(`Twitch auth failed: ${response.status}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

async function getChannelByUsername(username) {
  const token = await getAccessToken();

  const response = await fetch(
    `https://api.twitch.tv/helix/users?login=${username}`,
    {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) throw new Error(`Twitch API error: ${response.status}`);

  const data = await response.json();
  if (!data.data || data.data.length === 0) {
    throw new Error(`No Twitch channel found for: ${username}`);
  }

  return data.data[0];
}

async function getVODs(userId, limit = 10) {
  const token = await getAccessToken();

  const response = await fetch(
    `https://api.twitch.tv/helix/videos?user_id=${userId}&type=archive&first=${limit}`,
    {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) throw new Error(`Twitch VOD fetch error: ${response.status}`);

  const data = await response.json();
  return (data.data || []).map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description || '',
    url: v.url,
    publishedAt: v.published_at,
    duration: v.duration,
    viewCount: v.view_count,
  }));
}

async function fetchChannelData(username, scanDepth) {
  const channel = await getChannelByUsername(username);
  const vods = await getVODs(channel.id, scanDepth);

  return {
    channel: {
      id: channel.id,
      title: channel.display_name,
      handle: channel.login,
      description: channel.description,
      thumbnailUrl: channel.profile_image_url,
      viewCount: channel.view_count,
    },
    vods,
  };
}

module.exports = { fetchChannelData };
