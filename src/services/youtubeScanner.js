// Brand deal detection for YouTube via Perplexity AI
// Analyzes video descriptions for sponsored content disclosures

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Max chars per description sent to Perplexity — keeps token usage predictable
const MAX_DESC_CHARS = 1500;

/**
 * Build the detection prompt from channel metadata + video list.
 */
function buildDetectionPrompt(channel, videos) {
  const videoBlocks = videos
    .map((v, i) => {
      const desc = (v.description || '').slice(0, MAX_DESC_CHARS).trim();
      const date = v.publishedAt
        ? new Date(v.publishedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Unknown date';

      return `Video ${i + 1}: "${v.title}" (${date})
URL: ${v.url}
Description:
${desc || '[No description]'}`;
    })
    .join('\n\n---\n\n');

  return `You are a brand deal analyst specializing in YouTube creator sponsorships.
Analyze the following ${videos.length} video descriptions from the YouTube channel "${channel.title}" and identify ALL brand deals, sponsorships, and paid partnerships.

Look for:
- Explicit disclosures: "sponsored by", "paid partnership", "in collaboration with", "thank you to [brand]", "#ad", "#sponsored"
- Affiliate links or promo codes (e.g. "use code CREATOR for 10% off")
- Product integrations where a brand is named with a discount or call to action
- FTC disclosure language anywhere in the description
- YouTube's partner links and affiliate programs mentioned in description

For EACH brand deal found, return:
- brandName: the exact company or product name
- videoTitle: the video title where it appears
- videoUrl: the full YouTube URL
- publishedAt: the video publish date
- evidenceSnippet: the exact phrase revealing the deal (max 100 chars)
- dealType: one of "sponsorship", "affiliate", "gifted", "paid_partnership", "promo_code", "unknown"
- promoCode: any discount code mentioned, or null

Respond ONLY with a valid JSON object — no markdown, no explanation, no code fences:
{
  "brandsFound": [
    {
      "brandName": "string",
      "videoTitle": "string",
      "videoUrl": "string",
      "publishedAt": "string",
      "evidenceSnippet": "string",
      "dealType": "string",
      "promoCode": "string | null"
    }
  ],
  "videosWithDeals": number,
  "videosAnalyzed": number,
  "summary": "one sentence summary of findings"
}

If no brand deals are found, return brandsFound as an empty array.

VIDEO DATA:
${videoBlocks}`;
}

/**
 * Send descriptions to Perplexity and parse the response.
 */
async function detectBrands(channel, videos) {
  const prompt = buildDetectionPrompt(channel, videos);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content:
            'You are a brand deal analyst. Respond only with valid JSON. Never include markdown code fences, explanations, or any text outside the JSON object.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Perplexity API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content || '';

  const cleaned = rawContent
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('[youtubeScanner] Failed to parse Perplexity response:', cleaned);
    throw new Error('Brand detection returned malformed JSON. Raw: ' + cleaned.slice(0, 200));
  }

  return {
    brandsFound: Array.isArray(parsed.brandsFound) ? parsed.brandsFound : [],
    videosWithDeals: parsed.videosWithDeals ?? 0,
    videosAnalyzed: parsed.videosAnalyzed ?? videos.length,
    summary: parsed.summary ?? 'No summary returned.',
  };
}

/**
 * Aggregate raw deal list into unique brands with appearance history.
 * Same brand across multiple videos gets merged into one entry.
 */
function aggregateBrands(brandsFound) {
  const brandMap = {};

  for (const deal of brandsFound) {
    const key = deal.brandName.toLowerCase().trim();
    if (!brandMap[key]) {
      brandMap[key] = {
        brandName: deal.brandName,
        dealCount: 0,
        appearances: [],
        dealTypes: new Set(),
        promoCodes: [],
      };
    }
    brandMap[key].dealCount += 1;
    brandMap[key].dealTypes.add(deal.dealType);
    brandMap[key].appearances.push({
      videoTitle: deal.videoTitle,
      videoUrl: deal.videoUrl,
      publishedAt: deal.publishedAt,
      evidenceSnippet: deal.evidenceSnippet,
      dealType: deal.dealType,
      promoCode: deal.promoCode,
    });
    if (deal.promoCode) {
      brandMap[key].promoCodes.push(deal.promoCode);
    }
  }

  return Object.values(brandMap).map((b) => ({
    ...b,
    dealTypes: Array.from(b.dealTypes),
    promoCodes: [...new Set(b.promoCodes)],
  }));
}

/**
 * Full scan pipeline — takes channelData from youtubeService, returns structured results.
 */
async function runYoutubeScan(channelData) {
  const { channel, videos } = channelData;

  const videosWithContent = videos.filter(
    (v) => v.description && v.description.trim().length > 20
  );

  if (!videosWithContent.length) {
    return {
      channel,
      brandsFound: [],
      uniqueBrands: [],
      totalDealsFound: 0,
      uniqueBrandCount: 0,
      videosWithDeals: 0,
      videosAnalyzed: 0,
      summary: 'No video descriptions available to analyze.',
      videos,
    };
  }

  const detection = await detectBrands(channel, videosWithContent);
  const uniqueBrands = aggregateBrands(detection.brandsFound);

  return {
    channel,
    brandsFound: detection.brandsFound,
    uniqueBrands,
    totalDealsFound: detection.brandsFound.length,
    uniqueBrandCount: uniqueBrands.length,
    videosWithDeals: detection.videosWithDeals,
    videosAnalyzed: detection.videosAnalyzed,
    summary: detection.summary,
    videos,
  };
}

module.exports = {
  runYoutubeScan,
  detectBrands,
  aggregateBrands,
  buildDetectionPrompt,
};
