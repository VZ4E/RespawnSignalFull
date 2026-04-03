/**
 * Priority-based niche extractor for agency URLs
 * Matches URL segments against niche keywords and returns highest-priority match
 */

const NICHE_MAP = {
  // Priority 10: Specific games (highest priority)
  'fortnite': { niche: 'Fortnite/Battle Royale', priority: 10 },
  'valorant': { niche: 'Valorant/Tactical FPS', priority: 10 },
  'cs2': { niche: 'CS2/Competitive FPS', priority: 10 },
  'csgo': { niche: 'CSGO/Competitive FPS', priority: 10 },
  'counterstrike': { niche: 'Counter-Strike/Competitive FPS', priority: 10 },
  'apex': { niche: 'Apex Legends/Battle Royale', priority: 10 },
  'apexlegends': { niche: 'Apex Legends/Battle Royale', priority: 10 },
  'minecraft': { niche: 'Minecraft/Sandbox', priority: 10 },
  'mc': { niche: 'Minecraft/Sandbox', priority: 10 },
  'roblox': { niche: 'Roblox/Family Gaming', priority: 10 },

  // Priority 9: Esports/competitive categories
  'esports': { niche: 'Esports/Competitive', priority: 9 },
  'competitive': { niche: 'Esports/Competitive', priority: 9 },

  // Priority 8: Fitness/lifestyle
  'fitness': { niche: 'Fitness/Gaming', priority: 8 },
  'lifestyle': { niche: 'Lifestyle/IRL', priority: 8 },
  'irl': { niche: 'Lifestyle/IRL', priority: 8 },

  // Priority 7: Game categories
  'rpg': { niche: 'RPG/Story Games', priority: 7 },
  'strategy': { niche: 'Strategy/Esports', priority: 7 },
  'sports': { niche: 'Sports Games', priority: 7 },
  'racing': { niche: 'Racing/Simulation', priority: 7 },

  // Priority 6: Tech/entertainment
  'tech': { niche: 'Tech/Gaming', priority: 6 },
  'entertainment': { niche: 'Entertainment', priority: 6 },
  'influencer': { niche: 'Influencer', priority: 6 },
  'athlete': { niche: 'Athlete', priority: 6 },

  // Priority 1: Generic fallback (lowest priority)
  'gaming': { niche: 'Variety Gaming', priority: 1 },
  'variety': { niche: 'Variety Gaming', priority: 1 },
};

/**
 * Extract niche hint from URL using priority-based matching
 * Iterates through all URL segments and returns the highest-priority match
 * 
 * @param {string} url - The agency URL to parse (e.g., "https://dulcedo.com/profiles/gaming/fortnite")
 * @returns {object} { hint: string|null, isDirectMatch: boolean }
 */
function extractNicheHintFromUrl(url) {
  if (!url || typeof url !== 'string') {
    console.log(`[nicheExtractor] URL is null/undefined, returning null`);
    return { hint: null, isDirectMatch: false };
  }

  try {
    // Parse URL and extract path segments
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    const segments = pathname
      .split('/')
      .filter(Boolean)  // Remove empty strings
      .map(s => s.replace(/[^a-z0-9]/g, '')); // Remove special chars

    console.log(`[nicheExtractor] Parsing URL: "${url}"`);
    console.log(`[nicheExtractor] Normalized URL segments: ${segments.join(' -> ')}`);

    // Find all matches and track highest priority
    let bestMatch = null;
    let bestPriority = -1;

    for (const segment of segments) {
      if (NICHE_MAP[segment]) {
        const { niche, priority } = NICHE_MAP[segment];
        console.log(`[nicheExtractor] Found match: "${segment}" → "${niche}" (priority: ${priority})`);
        
        if (priority > bestPriority) {
          bestMatch = niche;
          bestPriority = priority;
          console.log(`[nicheExtractor] New best match: "${niche}" (priority: ${priority})`);
        }
      }
    }

    if (bestMatch) {
      console.log(`[nicheExtractor] ✓ Final match: "${bestMatch}" (priority: ${bestPriority})`);
      return { hint: bestMatch, isDirectMatch: true };
    }

    console.log(`[nicheExtractor] ✗ No niche keywords found in URL`);
    return { hint: null, isDirectMatch: false };

  } catch (e) {
    console.warn(`[nicheExtractor] Error parsing URL "${url}":`, e.message);
    return { hint: null, isDirectMatch: false };
  }
}

module.exports = {
  extractNicheHintFromUrl
};
