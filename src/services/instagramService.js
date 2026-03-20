const axios = require('axios');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY_INSTAGRAM;
const RAPIDAPI_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';

/**
 * Fetch Instagram user posts via RapidAPI Instagram Scraper Stable API
 * @param {string} usernameOrUrl - Instagram handle or profile URL
 * @param {number} amount - Number of posts to fetch (3, 14, or 30)
 * @returns {Promise<Array>} Array of post objects with caption, image, likes, etc
 */
async function getInstagramUserPosts(usernameOrUrl, amount = 30) {
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY_INSTAGRAM environment variable not set');
  }

  try {
    const response = await axios.post(
      'https://instagram-scraper-stable-api.p.rapidapi.com/get_ig_user_posts.php',
      {
        username_or_url: usernameOrUrl,
        amount: amount,
      },
      {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data || !response.data.posts) {
      return [];
    }

    // Normalize response: extract posts with captions
    return response.data.posts.map((post) => ({
      id: post.id || post.shortcode,
      caption: post.caption || '',
      image_url: post.display_url || post.media_src,
      likes: post.like_count || 0,
      comments: post.comments_count || 0,
      timestamp: post.timestamp || new Date().toISOString(),
      url: post.link || `https://instagram.com/p/${post.shortcode}`,
    }));
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Instagram user not found: ${usernameOrUrl}`);
    }
    if (error.response?.status === 429) {
      throw new Error('Instagram API rate limited - try again in a few minutes');
    }
    throw new Error(`Failed to fetch Instagram posts: ${error.message}`);
  }
}

/**
 * Fetch Instagram user profile info
 * @param {string} usernameOrUrl - Instagram handle or profile URL
 * @returns {Promise<Object>} User profile object with followers, bio, etc
 */
async function getInstagramUserProfile(usernameOrUrl) {
  if (!RAPIDAPI_KEY) {
    throw new Error('RAPIDAPI_KEY_INSTAGRAM environment variable not set');
  }

  try {
    const response = await axios.post(
      'https://instagram-scraper-stable-api.p.rapidapi.com/get_ig_user.php',
      {
        username_or_url: usernameOrUrl,
      },
      {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data) {
      throw new Error('No user data returned');
    }

    const user = response.data;
    return {
      username: user.username || usernameOrUrl,
      full_name: user.full_name || '',
      biography: user.biography || '',
      followers_count: user.followers_count || 0,
      following_count: user.following_count || 0,
      posts_count: user.posts_count || 0,
      profile_pic_url: user.profile_pic_url || '',
      is_verified: user.is_verified || false,
      url: user.url || `https://instagram.com/${user.username || usernameOrUrl}`,
    };
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Instagram user not found: ${usernameOrUrl}`);
    }
    throw new Error(`Failed to fetch Instagram profile: ${error.message}`);
  }
}

module.exports = {
  getInstagramUserPosts,
  getInstagramUserProfile,
};
