/**
 * AGENCY SEARCH — DATA LAYER (Vanilla JS)
 * Pure functions, no React dependency
 * 
 * This layer handles:
 * - Niche classification
 * - Supabase operations
 * - Perplexity scraping
 * - State management
 * 
 * Events emitted (custom events):
 * - 'agencySearchCreatorsLoaded'
 * - 'agencySearchError'
 * - 'agencySearchSuccess'
 * - 'agencySearchWatchlistAdd'
 * - 'agencySearchGroupScanAdd'
 */

// ═════════════════════════════════════════════════════════════════════════════
// NICHE CLASSIFICATION
// ═════════════════════════════════════════════════════════════════════════════

const NICHE_RULES = [
  {
    niche: 'FPS / Competitive',
    keywords: [
      'fps', 'valorant', 'warzone', 'cod', 'call of duty', 'apex', 'apex legends',
      'counter-strike', 'cs2', 'csgo', 'overwatch', 'halo', 'rainbow six',
      'pubg', 'battleground', 'competitive', 'esports', 'pro player',
      'tournament', 'ranked', 'sniper', 'gunplay', 'shooter',
    ],
    weight: 3,
  },
  {
    niche: 'Fortnite / Battle Royale',
    keywords: [
      'fortnite', 'fn', 'battle royale', 'zone wars', 'zonewars', 'box fight',
      'creative map', 'chapter', 'season', 'builds', 'build fight',
      'no build', 'rocket racing', 'festival', 'lego fortnite',
    ],
    weight: 4,
  },
  {
    niche: 'Minecraft / Sandbox',
    keywords: [
      'minecraft', 'mc', 'survival', 'skyblock', 'bedwars', 'hypixel',
      'sandbox', 'building', 'redstone', 'mods', 'modded', 'modpack',
      'terraria', 'valheim', 'stardew',
    ],
    weight: 3,
  },
  {
    niche: 'Roblox / Family Gaming',
    keywords: [
      'roblox', 'rblx', 'family', 'kids', 'kid-friendly', 'child',
      'adopt me', 'blox fruits', 'brookhaven', 'pet simulator',
      'anime fighting', 'kid safe', 'g-rated', 'all ages',
    ],
    weight: 4,
  },
  {
    niche: 'Fitness / Gaming Crossover',
    keywords: [
      'fitness', 'workout', 'gym', 'bodybuilding', 'crossfit', 'nutrition',
      'health', 'gains', 'muscle', 'weight loss', 'transformation',
      'athlete', 'training', 'diet', 'fit', 'kyana', 'gamer fitness',
      'gaming and fitness', 'stream and train',
    ],
    weight: 3,
  },
  {
    niche: 'Lifestyle / IRL',
    keywords: [
      'lifestyle', 'irl', 'vlog', 'vlogger', 'day in the life', 'travel',
      'food', 'cooking', 'dating', 'relationship', 'family vlog', 'just chatting',
      'react', 'reacts', 'commentary', 'storytelling', 'real life',
      'daily', 'daily routine', 'morning routine',
    ],
    weight: 2,
  },
  {
    niche: 'RPG / Story Games',
    keywords: [
      'rpg', 'jrpg', 'elden ring', 'dark souls', 'soulsborne', 'final fantasy',
      'persona', 'baldur', 'bg3', 'baldurs gate', 'cyberpunk', 'skyrim',
      'witcher', 'zelda', 'story', 'narrative', 'lore', 'open world',
      'single player', 'quest', 'adventure',
    ],
    weight: 3,
  },
  {
    niche: 'Strategy / Esports',
    keywords: [
      'strategy', 'rts', 'moba', 'league of legends', 'lol', 'dota',
      'starcraft', 'age of empires', 'teamfight tactics', 'tft',
      'chess', 'hearthstone', 'card game', 'deck building', 'esports analyst',
      'coaching', 'coach', 'meta', 'tier list',
    ],
    weight: 3,
  },
  {
    niche: 'Sports Games',
    keywords: [
      'nba 2k', 'fifa', 'ea fc', 'madden', 'mlb the show', 'nhl',
      'f1', 'racing', 'gt7', 'gran turismo', 'rocket league', 'rl',
      'sport', 'sports gaming', 'franchise mode', 'ultimate team', 'mut',
    ],
    weight: 3,
  },
  {
    niche: 'Variety Gaming',
    keywords: [
      'variety', 'all games', 'everything', 'mixed', 'different games',
      'whatever', 'chill', 'casual', 'just playing', 'gamer',
    ],
    weight: 1,
  },
  {
    niche: 'Tech / Gaming Adjacent',
    keywords: [
      'tech', 'technology', 'pc build', 'setup', 'review', 'unboxing',
      'hardware', 'gpu', 'cpu', 'monitor', 'peripherals', 'keyboard',
      'mouse', 'headset', 'streaming setup', 'content creation', 'creator',
      'youtube tips', 'grow on youtube', 'twitch tips',
    ],
    weight: 2,
  },
];

const ALL_NICHES = [
  'FPS / Competitive',
  'Fortnite / Battle Royale',
  'Minecraft / Sandbox',
  'Roblox / Family Gaming',
  'Fitness / Gaming Crossover',
  'Lifestyle / IRL',
  'RPG / Story Games',
  'Strategy / Esports',
  'Sports Games',
  'Variety Gaming',
  'Tech / Gaming Adjacent',
  'Uncategorized',
];

const NICHE_COLORS = {
  'FPS / Competitive':        { bg: '#FEE2E2', text: '#B91C1C', dot: '#EF4444' },
  'Fortnite / Battle Royale': { bg: '#F3E8FF', text: '#7E22CE', dot: '#A855F7' },
  'Minecraft / Sandbox':      { bg: '#DCFCE7', text: '#166534', dot: '#22C55E' },
  'Roblox / Family Gaming':   { bg: '#FFEDD5', text: '#92400E', dot: '#FB923C' },
  'Fitness / Gaming Crossover':{ bg: '#CCFBF1', text: '#134E4A', dot: '#14B8A6' },
  'Lifestyle / IRL':          { bg: '#FCE7F3', text: '#831843', dot: '#EC4899' },
  'RPG / Story Games':        { bg: '#E0E7FF', text: '#312E81', dot: '#6366F1' },
  'Strategy / Esports':       { bg: '#FEF3C7', text: '#92400E', dot: '#FBBF24' },
  'Sports Games':             { bg: '#DBEAFE', text: '#0C4A6E', dot: '#3B82F6' },
  'Variety Gaming':           { bg: '#F1F5F9', text: '#1E293B', dot: '#64748B' },
  'Tech / Gaming Adjacent':   { bg: '#CFFAFE', text: '#0E5E8C', dot: '#06B6D4' },
  'Uncategorized':            { bg: '#F3F4F6', text: '#4B5563', dot: '#9CA3AF' },
};

/**
 * Classify a creator into a niche based on handle, name, and description.
 * @returns { niche, confidence: 'high' | 'medium' | 'low' }
 */
function classifyNiche(handle, name, description) {
  const text = [handle, name, description]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const scores = {};

  for (const rule of NICHE_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += rule.weight;
        // Bonus for handle match
        if (handle.toLowerCase().includes(keyword.toLowerCase())) {
          score += rule.weight * 2;
        }
      }
    }
    if (score > 0) {
      scores[rule.niche] = (scores[rule.niche] || 0) + score;
    }
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) {
    return { niche: 'Uncategorized', confidence: 'low' };
  }

  const [topNiche, topScore] = sorted[0];
  const runnerUpScore = sorted[1]?.[1] ?? 0;

  let confidence;
  if (topScore >= 8 && topScore > runnerUpScore * 2) {
    confidence = 'high';
  } else if (topScore >= 4) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return { niche: topNiche, confidence };
}

/**
 * Group creators by niche
 */
function groupByNiche(creators) {
  const grouped = {};
  for (const creator of creators) {
    if (!grouped[creator.niche]) {
      grouped[creator.niche] = [];
    }
    grouped[creator.niche].push(creator);
  }
  return grouped;
}

/**
 * Compute niche breakdown for agency card
 */
function computeNicheBreakdown(creators) {
  const total = creators.length;
  if (total === 0) return [];

  const counts = {};
  for (const c of creators) {
    counts[c.niche] = (counts[c.niche] ?? 0) + 1;
  }

  return Object.entries(counts)
    .map(([niche, count]) => ({
      niche,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

// ═════════════════════════════════════════════════════════════════════════════
// PERPLEXITY SCRAPING
// ═════════════════════════════════════════════════════════════════════════════

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_MODEL = 'llama-3.1-sonar-large-128k-online';

async function callPerplexity(messages, apiKey) {
  const res = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages,
      max_tokens: 4000,
      temperature: 0.1,
      return_citations: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content ?? '';
}

/**
 * Scrape a talent agency URL
 */
async function scrapeAgencyUrl(url, apiKey) {
  const systemPrompt = `You are a data extraction assistant for a creator intelligence platform.
Your job: extract a structured list of creators/talent from a given agency or roster URL.
Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

JSON schema:
{
  "agencyName": "string",
  "creators": [
    {
      "handle": "string (primary social handle, no @ symbol)",
      "name": "string or null (real name if known)",
      "platforms": ["YouTube"|"TikTok"|"Twitch"|"Instagram"|"X"|"Kick"],
      "followerCount": number or null (total combined, in raw number),
      "followerCountFormatted": "string or null (e.g. '2.4M', '850K')",
      "description": "string or null (what they make content about, max 120 chars)",
      "profileUrl": "string or null (primary profile URL)"
    }
  ]
}

Rules:
- Extract as many creators as visible on the page (target 20–50)
- If a creator is on multiple platforms, list all
- followerCount should be the TOTAL across all platforms if possible
- description should describe their CONTENT NICHE specifically
- If you cannot determine real name, set name to null
- handles should be clean — no spaces, no @ prefix
- Return an empty creators array if no creators are found`;

  const userPrompt = `Extract all creators/talent from this agency or roster page: ${url}

Search for the page content, roster, talent section, or creator list. Extract every creator you find.`;

  const raw = await callPerplexity(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    apiKey
  );

  return parsePerplexityCreatorResponse(raw, url, 'url');
}

/**
 * Enrich creator handles with data
 */
async function enrichCreatorHandles(handles, apiKey) {
  const systemPrompt = `You are a creator intelligence assistant.
Given a list of creator handles, return structured information about each one.
Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

JSON schema:
{
  "agencyName": "Imported Roster",
  "creators": [
    {
      "handle": "string",
      "name": "string or null",
      "platforms": ["YouTube"|"TikTok"|"Twitch"|"Instagram"|"X"|"Kick"],
      "followerCount": number or null,
      "followerCountFormatted": "string or null",
      "description": "string or null (content niche, max 120 chars)",
      "profileUrl": "string or null"
    }
  ]
}

If you cannot find info on a handle, still include it with null values.`;

  const userPrompt = `Look up these creator handles and return their info:\n${handles.join('\n')}`;

  const raw = await callPerplexity(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    apiKey
  );

  return parsePerplexityCreatorResponse(raw, undefined, 'manual');
}

function parsePerplexityCreatorResponse(raw, sourceUrl, source) {
  const cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Perplexity returned unparseable response.');
    }
    parsed = JSON.parse(match[0]);
  }

  const rawCreators = parsed.creators ?? [];

  const creators = rawCreators
    .filter((c) => c.handle && c.handle.trim())
    .map((c) => {
      const handle = c.handle.replace('@', '').trim();
      const platforms = normalizePlatforms(c.platforms ?? []);
      const { niche, confidence } = classifyNiche(
        handle,
        c.name ?? undefined,
        c.description ?? undefined
      );

      return {
        handle,
        name: c.name ?? undefined,
        platform: platforms,
        followerCount: c.followerCount ?? undefined,
        followerCountFormatted: c.followerCountFormatted ?? undefined,
        description: c.description ?? undefined,
        profileUrl: c.profileUrl ?? undefined,
        niche,
        confidence,
      };
    });

  return {
    agencyName: parsed.agencyName ?? 'Imported Agency',
    agencyUrl: sourceUrl,
    creators,
    scrapedAt: new Date().toISOString(),
    source,
  };
}

function normalizePlatforms(platforms) {
  const validPlatforms = ['YouTube', 'TikTok', 'Twitch', 'Instagram', 'X', 'Kick'];
  return platforms
    .map((p) => {
      const normalized = p.trim();
      if (/youtube/i.test(normalized)) return 'YouTube';
      if (/tiktok/i.test(normalized)) return 'TikTok';
      if (/twitch/i.test(normalized)) return 'Twitch';
      if (/instagram|ig/i.test(normalized)) return 'Instagram';
      if (/twitter|^x$/i.test(normalized)) return 'X';
      if (/kick/i.test(normalized)) return 'Kick';
      return null;
    })
    .filter((p) => p !== null && validPlatforms.includes(p));
}

/**
 * Mock data for development
 */
function getMockScrapeResult(url) {
  return {
    agencyName: 'Demo Gaming Agency',
    agencyUrl: url,
    scrapedAt: new Date().toISOString(),
    source: 'mock',
    creators: [
      {
        handle: 'HotRodd',
        name: 'HotRodd',
        platform: ['Twitch', 'YouTube'],
        niche: 'FPS / Competitive',
        followerCount: 280000,
        followerCountFormatted: '280K',
        description: 'Warzone and competitive FPS content',
        confidence: 'high',
      },
      {
        handle: 'ZoneWarsKing',
        name: null,
        platform: ['YouTube', 'TikTok'],
        niche: 'Fortnite / Battle Royale',
        followerCount: 1400000,
        followerCountFormatted: '1.4M',
        description: 'Fortnite Zone Wars and creative maps',
        confidence: 'high',
      },
      {
        handle: 'KyanaFit',
        name: 'Kyana',
        platform: ['Instagram', 'TikTok', 'YouTube'],
        niche: 'Fitness / Gaming Crossover',
        followerCount: 920000,
        followerCountFormatted: '920K',
        description: 'Fitness meets gaming lifestyle content',
        confidence: 'high',
      },
      {
        handle: 'CasualVibesDaily',
        platform: ['YouTube', 'Twitch'],
        niche: 'Lifestyle / IRL',
        followerCount: 450000,
        followerCountFormatted: '450K',
        description: 'Daily vlog and just chatting streams',
        confidence: 'medium',
      },
      {
        handle: 'RobloxFam',
        name: null,
        platform: ['YouTube', 'TikTok'],
        niche: 'Roblox / Family Gaming',
        followerCount: 2200000,
        followerCountFormatted: '2.2M',
        description: 'Family-friendly Roblox content',
        confidence: 'high',
      },
    ],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT (Vanilla JS)
// ═════════════════════════════════════════════════════════════════════════════

class SupabaseClient {
  constructor(supabaseUrl, supabaseAnonKey) {
    this.url = supabaseUrl;
    this.anonKey = supabaseAnonKey;
  }

  async _request(method, path, body = null, headers = {}) {
    const url = `${this.url}/rest/v1${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.anonKey}`,
        'apikey': this.anonKey,
        ...headers,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data;
  }

  // ─── Agencies ─────────────────────────────────────────────────────────────

  async getAgencies(userId) {
    return this._request('GET', `/agencies?user_id=eq.${userId}`);
  }

  async createAgency(name, url, userId) {
    return this._request('POST', '/agencies', { name, url, user_id: userId });
  }

  async deleteAgency(agencyId) {
    return this._request('DELETE', `/agencies?id=eq.${agencyId}`);
  }

  // ─── Creators ─────────────────────────────────────────────────────────────

  async getCreatorsByAgency(agencyId) {
    return this._request('GET', `/agency_creators?agency_id=eq.${agencyId}`);
  }

  async upsertCreators(agencyId, creators) {
    const rows = creators.map((c) => ({
      agency_id: agencyId,
      handle: c.handle,
      name: c.name,
      platform: c.platform,
      niche: c.niche,
      follower_count: c.followerCount,
      follower_count_formatted: c.followerCountFormatted,
      description: c.description,
      profile_url: c.profileUrl,
    }));

    return this._request('POST', '/agency_creators', rows, {
      'Prefer': 'resolution=merge-duplicates',
    });
  }

  // ─── Watchlist ────────────────────────────────────────────────────────────

  async addToWatchlist(userId, creatorId) {
    return this._request('POST', '/creator_watchlist', { user_id: userId, creator_id: creatorId });
  }

  async getWatchlist(userId) {
    return this._request('GET', `/creator_watchlist?user_id=eq.${userId}`);
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  async createGroup(name, userId) {
    return this._request('POST', '/creator_groups', { name, user_id: userId });
  }

  async getGroups(userId) {
    return this._request('GET', `/creator_groups?user_id=eq.${userId}`);
  }

  async addCreatorsToGroup(groupId, creatorIds) {
    const rows = creatorIds.map((id) => ({
      group_id: groupId,
      creator_id: id,
    }));
    return this._request('POST', '/group_creators', rows, {
      'Prefer': 'resolution=merge-duplicates',
    });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

window.AgencySearchData = {
  // Niche functions
  classifyNiche,
  groupByNiche,
  computeNicheBreakdown,
  ALL_NICHES,
  NICHE_COLORS,

  // Scraping functions
  scrapeAgencyUrl,
  enrichCreatorHandles,
  getMockScrapeResult,

  // Supabase
  SupabaseClient,

  // Utilities
  normalizePlatforms,
};
