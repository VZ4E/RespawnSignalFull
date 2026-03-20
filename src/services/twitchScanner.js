const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const MAX_DESC_CHARS = 1500;

function buildDetectionPrompt(channel, vods) {
  const vodBlocks = vods
    .map((v, i) => {
      const desc = (v.description || '').slice(0, MAX_DESC_CHARS).trim();
      const date = v.publishedAt
        ? new Date(v.publishedAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })
        : 'Unknown date';

      return `VOD ${i + 1}: "${v.title}" (${date})
URL: ${v.url}
Description:
${desc || '[No description]'}`;
    })
    .join('\n\n---\n\n');

  return `You are a brand deal analyst specializing in Twitch creator sponsorships.
Analyze the following ${vods.length} VOD titles and descriptions from the Twitch channel "${channel.title}" and identify ALL brand deals, sponsorships, and paid partnerships.

Look for:
- Explicit disclosures: "sponsored by", "paid partnership", "in collaboration with", "thank you to [brand]"
- Affiliate links or promo codes (e.g. "use code CREATOR for 10% off")
- Product integrations where a brand is named with a discount or call to action
- Brand names followed by URLs or discount codes in descriptions

For EACH brand deal found, return:
- brandName: the exact company or product name
- vodTitle: the VOD title where it appears
- vodUrl: the full Twitch URL
- publishedAt: the VOD publish date
- evidenceSnippet: the exact phrase revealing the deal (max 100 chars)
- dealType: one of "sponsorship", "affiliate", "gifted", "paid_partnership", "promo_code", "unknown"
- promoCode: any discount code mentioned, or null

Respond ONLY with a valid JSON object — no markdown, no explanation, no code fences:
{
  "brandsFound": [...],
  "vodsWithDeals": number,
  "vodsAnalyzed": number,
  "summary": "one sentence summary"
}

If no brand deals are found, return brandsFound as an empty array.

VOD DATA:
${vodBlocks}`;
}

async function detectBrands(channel, vods) {
  const prompt = buildDetectionPrompt(channel, vods);

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
          content: 'You are a brand deal analyst. Respond only with valid JSON. Never include markdown code fences or any text outside the JSON object.',
        },
        { role: 'user', content: prompt },
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
  const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Brand detection returned malformed JSON: ' + cleaned.slice(0, 200));
  }

  return {
    brandsFound: Array.isArray(parsed.brandsFound) ? parsed.brandsFound : [],
    vodsWithDeals: parsed.vodsWithDeals ?? 0,
    vodsAnalyzed: parsed.vodsAnalyzed ?? vods.length,
    summary: parsed.summary ?? 'No summary returned.',
  };
}

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
      vodTitle: deal.vodTitle,
      vodUrl: deal.vodUrl,
      publishedAt: deal.publishedAt,
      evidenceSnippet: deal.evidenceSnippet,
      dealType: deal.dealType,
      promoCode: deal.promoCode,
    });
    if (deal.promoCode) brandMap[key].promoCodes.push(deal.promoCode);
  }

  return Object.values(brandMap).map((b) => ({
    ...b,
    dealTypes: Array.from(b.dealTypes),
    promoCodes: [...new Set(b.promoCodes)],
  }));
}

async function runTwitchScan(channelData) {
  const { channel, vods } = channelData;

  const vodsWithContent = vods.filter(
    (v) => (v.title && v.title.trim().length > 3) || (v.description && v.description.trim().length > 20)
  );

  if (!vodsWithContent.length) {
    return {
      channel,
      brandsFound: [],
      uniqueBrands: [],
      totalDealsFound: 0,
      uniqueBrandCount: 0,
      vodsWithDeals: 0,
      vodsAnalyzed: 0,
      summary: 'No VOD data available to analyze.',
      vods,
    };
  }

  const detection = await detectBrands(channel, vodsWithContent);
  const uniqueBrands = aggregateBrands(detection.brandsFound);

  return {
    channel,
    brandsFound: detection.brandsFound,
    uniqueBrands,
    totalDealsFound: detection.brandsFound.length,
    uniqueBrandCount: uniqueBrands.length,
    vodsWithDeals: detection.vodsWithDeals,
    vodsAnalyzed: detection.vodsAnalyzed,
    summary: detection.summary,
    vods,
  };
}

module.exports = { runTwitchScan };
