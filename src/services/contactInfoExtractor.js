/**
 * Contact Info Extractor Service
 * Extracts business emails and bio links from creator profiles across platforms
 * with fuzzy matching fallback to past TikTok scans
 */

const fetch = require('node-fetch');
const { supabase } = require('../supabase');

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Extract business email and bio links from biography text
 */
function extractContactsFromBio(bio) {
  const businessEmail = null;
  const bioLinks = [];

  if (!bio) {
    return { businessEmail, bioLinks };
  }

  // Extract business emails from bio
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailMatches = bio.match(emailPattern) || [];
  console.log(`[ContactInfo] Found ${emailMatches.length} total emails in bio`);

  // Filter for business emails (not personal domains)
  const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'msn.com', 'live.com', 'mail.com', 'yandex.com', 'qq.com', 'gmx.com', 'mail.ru', 'inbox.com'];
  const businessEmails = emailMatches.filter(email => {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain && !personalDomains.includes(domain);
  });

  let extractedEmail = null;
  if (businessEmails.length > 0) {
    extractedEmail = businessEmails[0];
    console.log(`[ContactInfo] Found business email: ${extractedEmail}`);
  } else {
    console.log(`[ContactInfo] No business email found (${emailMatches.length} emails are personal domains)`);
  }

  // Extract URLs from bio
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
  const urlMatches = bio.match(urlPattern) || [];
  console.log(`[ContactInfo] Found ${urlMatches.length} potential URLs in bio`);

  urlMatches.forEach(url => {
    if (!bioLinks.includes(url)) {
      const isEmailDomain = personalDomains.some(domain => url.toLowerCase().includes(domain));
      if (!isEmailDomain) {
        const normalizedUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;
        bioLinks.push(normalizedUrl);
        console.log(`[ContactInfo] Added bio link: ${normalizedUrl}`);
      }
    }
  });

  if (bioLinks.length === 0) {
    console.log(`[ContactInfo] No bio links found`);
  }

  return { businessEmail: extractedEmail, bioLinks };
}

/**
 * Fuzzy match usernames — check if they're likely the same creator
 * Returns true if:
 * - First 5+ characters match
 * - One username contains the other (e.g., "foxman" vs "foxman1x")
 */
function isSimilarUsername(username1, username2) {
  const u1 = username1.toLowerCase().replace(/^@/, '').trim();
  const u2 = username2.toLowerCase().replace(/^@/, '').trim();

  if (u1 === u2) return true;

  // Check if first 5+ characters match
  if (u1.length >= 5 && u2.length >= 5) {
    if (u1.substring(0, 5) === u2.substring(0, 5)) {
      return true;
    }
  }

  // Check if one contains the other
  if (u1.includes(u2) || u2.includes(u1)) {
    return true;
  }

  return false;
}

/**
 * Try to find contact info from past TikTok scans using fuzzy username matching
 */
async function findContactsFromPastTikTokScans(username, userId) {
  console.log(`[ContactInfo] Fuzzy matching against past TikTok scans for @${username}`);

  try {
    // Query recent TikTok scans for this user
    const { data: tiktokScans, error } = await supabase
      .from('scans')
      .select('username, business_email, bio_links')
      .eq('user_id', userId)
      .eq('platform', 'tiktok')
      .not('business_email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn(`[ContactInfo] Error querying past TikTok scans:`, error.message);
      return { businessEmail: null, bioLinks: [] };
    }

    if (!tiktokScans || tiktokScans.length === 0) {
      console.log(`[ContactInfo] No past TikTok scans found`);
      return { businessEmail: null, bioLinks: [] };
    }

    // Find best fuzzy match
    for (const scan of tiktokScans) {
      if (isSimilarUsername(username, scan.username)) {
        console.log(`[ContactInfo] Fuzzy match found: @${scan.username} is likely same creator as @${username}`);
        return {
          businessEmail: scan.business_email,
          bioLinks: scan.bio_links || [],
        };
      }
    }

    console.log(`[ContactInfo] No fuzzy match found among ${tiktokScans.length} past TikTok scans`);
    return { businessEmail: null, bioLinks: [] };
  } catch (err) {
    console.warn(`[ContactInfo] Error in fuzzy matching:`, err.message);
    return { businessEmail: null, bioLinks: [] };
  }
}

/**
 * Get Twitch channel info and extract contacts from bio
 */
async function getTwitchContactInfo(username, userId) {
  console.log(`[ContactInfo] Attempting to extract contact info from Twitch channel @${username}`);

  try {
    // Get Twitch access token using Client Credentials flow
    const tokenResp = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials',
      }),
    });

    if (!tokenResp.ok) {
      console.warn(`[ContactInfo] Failed to get Twitch token: ${tokenResp.status}`);
      return findContactsFromPastTikTokScans(username, userId);
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;

    // Get channel info
    const channelResp = await fetch(
      `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(username)}&first=1`,
      {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!channelResp.ok) {
      console.warn(`[ContactInfo] Failed to fetch Twitch channel info: ${channelResp.status}`);
      return findContactsFromPastTikTokScans(username, userId);
    }

    const channelData = await channelResp.json();
    const channel = channelData.data?.[0];

    if (!channel) {
      console.log(`[ContactInfo] Twitch channel not found, falling back to fuzzy match`);
      return findContactsFromPastTikTokScans(username, userId);
    }

    const description = channel.broadcaster_language && channel.description ? decodeHtmlEntities(channel.description) : '';
    console.log(`[ContactInfo] Twitch bio: "${description.substring(0, 150)}"`);

    const { businessEmail, bioLinks } = extractContactsFromBio(description);

    // If found contacts, return them
    if (businessEmail || bioLinks.length > 0) {
      console.log(`[ContactInfo] Found contact info in Twitch bio`);
      return { businessEmail, bioLinks };
    }

    // Otherwise, fall back to fuzzy matching
    console.log(`[ContactInfo] No contacts found in Twitch bio, falling back to fuzzy match`);
    return findContactsFromPastTikTokScans(username, userId);
  } catch (err) {
    console.warn(`[ContactInfo] Error extracting Twitch contact info:`, err.message);
    return findContactsFromPastTikTokScans(username, userId);
  }
}

/**
 * Get YouTube channel info and extract contacts from bio
 */
async function getYouTubeContactInfo(username, userId) {
  console.log(`[ContactInfo] Attempting to extract contact info from YouTube channel @${username}`);

  try {
    // YouTube API call to get channel info by username
    const channelResp = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&forUsername=${encodeURIComponent(username)}&key=${process.env.YOUTUBE_API_KEY}`
    );

    if (!channelResp.ok) {
      console.warn(`[ContactInfo] Failed to fetch YouTube channel: ${channelResp.status}`);
      return findContactsFromPastTikTokScans(username, userId);
    }

    const channelData = await channelResp.json();
    const channel = channelData.items?.[0];

    if (!channel) {
      console.log(`[ContactInfo] YouTube channel not found, falling back to fuzzy match`);
      return findContactsFromPastTikTokScans(username, userId);
    }

    const description = channel.snippet?.description || '';
    console.log(`[ContactInfo] YouTube bio: "${description.substring(0, 150)}"`);

    const { businessEmail, bioLinks } = extractContactsFromBio(description);

    // If found contacts, return them
    if (businessEmail || bioLinks.length > 0) {
      console.log(`[ContactInfo] Found contact info in YouTube bio`);
      return { businessEmail, bioLinks };
    }

    // Otherwise, fall back to fuzzy matching
    console.log(`[ContactInfo] No contacts found in YouTube bio, falling back to fuzzy match`);
    return findContactsFromPastTikTokScans(username, userId);
  } catch (err) {
    console.warn(`[ContactInfo] Error extracting YouTube contact info:`, err.message);
    return findContactsFromPastTikTokScans(username, userId);
  }
}

/**
 * Get Instagram profile info and extract contacts from bio
 */
async function getInstagramContactInfo(username, userId) {
  console.log(`[ContactInfo] Attempting to extract contact info from Instagram @${username}`);

  try {
    // Use RapidAPI Instagram scraper endpoint
    const profileResp = await fetch(
      `https://instagram-scraper-api2.p.rapidapi.com/v1/info?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': process.env.RAPIDAPI_KEY,
          'x-rapidapi-host': 'instagram-scraper-api2.p.rapidapi.com',
        },
      }
    );

    if (!profileResp.ok) {
      console.warn(`[ContactInfo] Failed to fetch Instagram profile: ${profileResp.status}`);
      return findContactsFromPastTikTokScans(username, userId);
    }

    const profileData = await profileResp.json();
    const userInfo = profileData?.data || profileData;

    if (!userInfo) {
      console.log(`[ContactInfo] Instagram profile not found, falling back to fuzzy match`);
      return findContactsFromPastTikTokScans(username, userId);
    }

    const bio = decodeHtmlEntities(userInfo.biography || '');
    console.log(`[ContactInfo] Instagram bio: "${bio.substring(0, 150)}"`);

    const { businessEmail, bioLinks } = extractContactsFromBio(bio);

    // If found contacts, return them
    if (businessEmail || bioLinks.length > 0) {
      console.log(`[ContactInfo] Found contact info in Instagram bio`);
      return { businessEmail, bioLinks };
    }

    // Otherwise, fall back to fuzzy matching
    console.log(`[ContactInfo] No contacts found in Instagram bio, falling back to fuzzy match`);
    return findContactsFromPastTikTokScans(username, userId);
  } catch (err) {
    console.warn(`[ContactInfo] Error extracting Instagram contact info:`, err.message);
    return findContactsFromPastTikTokScans(username, userId);
  }
}

/**
 * Main entry point — get contact info for any platform
 */
async function getContactInfo(platform, username, userId) {
  console.log(`[ContactInfo] Getting contact info for ${platform} @${username}`);

  switch (platform?.toLowerCase()) {
    case 'twitch':
      return getTwitchContactInfo(username, userId);
    case 'youtube':
      return getYouTubeContactInfo(username, userId);
    case 'instagram':
      return getInstagramContactInfo(username, userId);
    case 'tiktok':
      // TikTok contact extraction happens in scan.js already
      console.log(`[ContactInfo] TikTok contact extraction handled in main scan flow`);
      return { businessEmail: null, bioLinks: [] };
    default:
      console.warn(`[ContactInfo] Unknown platform: ${platform}`);
      return { businessEmail: null, bioLinks: [] };
  }
}

module.exports = {
  getContactInfo,
  extractContactsFromBio,
  isSimilarUsername,
  findContactsFromPastTikTokScans,
};
