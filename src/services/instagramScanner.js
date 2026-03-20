const axios = require('axios');
const instagramService = require('./instagramService');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

/**
 * Scan Instagram posts for brand deals and sponsorships using Perplexity
 * @param {string} handle - Instagram handle (e.g., @linustechips)
 * @param {number} scanDepth - Number of posts to scan (3, 14, or 30)
 * @returns {Promise<Object>} Scan results with detected deals and metadata
 */
async function scanInstagramChannel(handle, scanDepth = 30) {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY environment variable not set');
  }

  // Normalize handle: remove @ if present
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  try {
    // Fetch user profile and posts
    const [profile, posts] = await Promise.all([
      instagramService.getInstagramUserProfile(cleanHandle),
      instagramService.getInstagramUserPosts(cleanHandle, scanDepth),
    ]);

    if (!posts || posts.length === 0) {
      return {
        success: true,
        channel_handle: cleanHandle,
        channel_name: profile.username,
        channel_thumbnail: profile.profile_pic_url,
        subscriber_count: profile.followers_count,
        scan_depth: scanDepth,
        videos_scanned: 0,
        deals_found: [],
        brands_detected: [],
        keywords_matched: [],
      };
    }

    // Combine all post captions for analysis
    const allCaptions = posts
      .map((post, idx) => `Post ${idx + 1}: ${post.caption}`)
      .join('\n\n');

    // Call Perplexity to detect brand deals
    const prompt = `You are a brand partnership analyst. Analyze the following Instagram posts and identify ANY mentions of brand partnerships, sponsorships, collaborations, paid promotions, or affiliate links.

Instagram Posts:
${allCaptions}

For EACH brand partnership or sponsorship found, provide:
1. Brand name
2. Post number(s) it appears in
3. Type of deal (sponsorship, collaboration, affiliate, paid partnership, etc.)
4. Keywords that indicate the deal (e.g., "#ad", "#sponsored", "#partner", "collaboration", "brand ambassador", etc.)

If no brand partnerships are found, respond with "No brand partnerships detected."

Format your response as a JSON array like this (even if empty):
[
  {
    "brand": "Brand Name",
    "post_numbers": [1, 2],
    "deal_type": "sponsorship",
    "keywords": ["#ad", "#sponsored"]
  }
]

ONLY return the JSON array, no additional text.`;

    const response = await axios.post(
      PERPLEXITY_API_URL,
      {
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    let deals = [];
    const responseText = response.data.choices[0]?.message?.content || '';

    if (responseText && !responseText.includes('No brand partnerships')) {
      try {
        // Extract JSON from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          deals = JSON.parse(jsonMatch[0]);
        }
      } catch (parseErr) {
        // If JSON parsing fails, return raw response as text
        console.warn('Failed to parse Perplexity response as JSON:', parseErr.message);
      }
    }

    // Extract unique brands and keywords
    const brandsDetected = [...new Set(deals.map((d) => d.brand).filter(Boolean))];
    const keywordsMatched = [
      ...new Set(
        deals
          .flatMap((d) => d.keywords || [])
          .filter(Boolean)
          .map((k) => k.toLowerCase())
      ),
    ];

    return {
      success: true,
      channel_handle: cleanHandle,
      channel_name: profile.username,
      channel_thumbnail: profile.profile_pic_url,
      subscriber_count: profile.followers_count,
      scan_depth: scanDepth,
      videos_scanned: posts.length,
      deals_found: deals,
      brands_detected: brandsDetected,
      keywords_matched: keywordsMatched,
    };
  } catch (error) {
    throw new Error(`Failed to scan Instagram channel: ${error.message}`);
  }
}

module.exports = {
  scanInstagramChannel,
};
