const axios = require('axios');
const instagramService = require('./instagramService');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

const MAX_CAPTION_CHARS = 800;

function buildDetectionPrompt(posts) {
  const postBlocks = posts
    .map((post, i) => {
      const caption = (post.caption || '').slice(0, MAX_CAPTION_CHARS).trim();
      return `Post ${i + 1}:\n${caption || '[No caption]'}`;
    })
    .join('\n\n---\n\n');

  return `You are a brand deal analyst specializing in Instagram creator sponsorships.
Analyze the following ${posts.length} Instagram post captions and identify ALL brand deals, sponsorships, and paid partnerships.

Look for:
- #ad, #sponsored, #partner, #collab, #gifted, #paidpartnership
- "in partnership with", "sponsored by", "thank you to [brand]"
- Affiliate links or promo codes (e.g. "use code CREATOR for 10% off")
- Brand ambassador language
- FTC disclosure language

For EACH brand deal found, return:
- brandName: the exact company or product name
- postNumber: the post number where it appears
- evidenceSnippet: the exact phrase revealing the deal (max 100 chars)
- dealType: one of "sponsorship", "affiliate", "gifted", "paid_partnership", "promo_code", "unknown"
- promoCode: any discount code mentioned, or null

Respond ONLY with a valid JSON object — no markdown, no explanation, no code fences:
{
  "brandsFound": [
    {
      "brandName": "string",
      "postNumber": number,
      "evidenceSnippet": "string",
      "dealType": "string",
      "promoCode": "string | null"
    }
  ],
  "postsWithDeals": number,
  "postsAnalyzed": number,
  "summary": "one sentence summary of findings"
}

If no brand deals are found, return brandsFound as an empty array.

POST DATA:
${postBlocks}`;
}

async function scanInstagramChannel(handle, scanDepth = 30) {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY environment variable not set');
  }

  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

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

  const prompt = buildDetectionPrompt(posts);

  const response = await axios.post(
    PERPLEXITY_API_URL,
    {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content:
            'You are a brand deal analyst. Respond only with valid JSON. Never include markdown code fences, explanations, or any text outside the JSON object. Keep your response concise.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    },
    {
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const rawContent = response.data.choices[0]?.message?.content || '';
  const cleaned = rawContent
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[instagramScanner] Failed to parse Perplexity response:', cleaned);
    parsed = { brandsFound: [], postsWithDeals: 0, postsAnalyzed: posts.length, summary: 'Parse error.' };
  }

  const brandsFound = Array.isArray(parsed.brandsFound) ? parsed.brandsFound : [];
  const brandsDetected = [...new Set(brandsFound.map((d) => d.brandName).filter(Boolean))];
  const keywordsMatched = [...new Set(brandsFound.map((d) => d.dealType).filter(Boolean))];

  return {
    success: true,
    channel_handle: cleanHandle,
    channel_name: profile.username,
    channel_thumbnail: profile.profile_pic_url,
    subscriber_count: profile.followers_count,
    scan_depth: scanDepth,
    videos_scanned: posts.length,
    deals_found: brandsFound,
    brands_detected: brandsDetected,
    keywords_matched: keywordsMatched,
    summary: parsed.summary ?? 'No summary returned.',
  };
}

module.exports = {
  scanInstagramChannel,
};
