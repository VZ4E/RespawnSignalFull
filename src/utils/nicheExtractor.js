/**
 * Niche Extraction Utility
 * Extracts niche hints from creator URLs using priority-based matching
 * 
 * Priority Order (highest = most specific):
 * 1. Platform-specific niches (Fortnite, Valorant, Minecraft, etc.) - priority 10-9
 * 2. General categories (FPS, Sandbox, etc.) - priority 9-8
 * 3. Content types (Athlete, Entertainment) - priority 8-7
 * 4. Broader categories (Lifestyle, Influencer) - priority 6
 * 5. Generic fallback (Gaming, Gamers) - priority 1
 */

/**
 * Extract a niche hint from a creator's URL/bio
 * @param {string} url - Creator profile URL or bio text
 * @returns {object} { hint: string|null, isDirectMatch: boolean }
 */
function extractNicheHintFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return { hint: null, isDirectMatch: false };
  }

  // Normalize URL
  const normalized = url.toLowerCase().trim();
  
  // Split by common path separators and query params
  const segments = normalized
    .replace(/^https?:\/\//i, '')  // Remove protocol
    .split(/[/?&#]/)                // Split on path/query separators
    .filter(s => s.length > 0)      // Remove empty strings
    .map(s => s.trim());

  console.log(`[nicheExtractor] Normalized URL segments: ${segments.join(' -> ')}`);

  // Define niche map with priority scores (highest priority first)
  // More specific mappings take precedence over generic ones
  const nicheMap = [
    // === MOST SPECIFIC FIRST ===
    // Specific games (highest priority - game titles)
    { keywords: ['fortnite'], niche: 'Fortnite/Battle Royale', priority: 10 },
    { keywords: ['valorant'], niche: 'Valorant/Tactical FPS', priority: 10 },
    { keywords: ['csgo', 'cs2', 'counterstrike'], niche: 'Counter-Strike/Competitive FPS', priority: 10 },
    { keywords: ['minecraft', 'mc'], niche: 'Minecraft/Sandbox', priority: 9 },
    { keywords: ['roblox'], niche: 'Roblox/User-Generated Games', priority: 9 },
    { keywords: ['apex', 'apexlegends'], niche: 'Apex Legends/Battle Royale', priority: 9 },
    { keywords: ['warzone'], niche: 'Call of Duty Warzone/Battle Royale', priority: 9 },
    { keywords: ['genshin', 'genshinimpact'], niche: 'Genshin Impact/RPG', priority: 9 },
    { keywords: ['twitch', 'streaming'], niche: 'Twitch Streaming/Content Creator', priority: 9 },

    // === CATEGORY LEVEL (Higher priority) ===
    // FPS & Competitive Gaming
    { keywords: ['fps', 'firstperson', 'shooter', 'competitive'], niche: 'FPS/Competitive Gaming', priority: 8 },
    
    // Sandbox & Creative
    { keywords: ['sandbox', 'creative', 'building'], niche: 'Sandbox/Creative Gaming', priority: 8 },
    
    // Fitness & Sports
    { keywords: ['athlete', 'athletes', 'sports'], niche: 'Athlete/Sports', priority: 9 },
    { keywords: ['fitness', 'gym', 'workout', 'trainer'], niche: 'Fitness/Gaming', priority: 8 },
    
    // Entertainment & Content Creation
    { keywords: ['entertainment', 'entertainers', 'content'], niche: 'Entertainment', priority: 7 },
    { keywords: ['creator', 'creators'], niche: 'Content Creator', priority: 7 },

    // === BROADER CATEGORIES ===
    // Influencer & Lifestyle (medium-low priority - generic)
    { keywords: ['influencer', 'influencers'], niche: 'Lifestyle/IRL', priority: 6 },
    { keywords: ['lifestyle', 'fashion', 'irl'], niche: 'Lifestyle/IRL', priority: 6 },
    
    // === GENERIC FALLBACK (Lowest priority) ===
    // Generic gaming terms should match LAST, not first
    { keywords: ['gaming', 'gamers', 'gamer', 'game'], niche: 'Variety Gaming', priority: 1 },
  ];

  // Find ALL matches across ALL segments, return the one with highest priority
  let bestMatch = null;

  for (const segment of segments) {
    for (const entry of nicheMap) {
      // Check if this segment contains any of the entry's keywords
      if (entry.keywords.includes(segment)) {
        // If this match has higher priority than our current best, update
        if (!bestMatch || entry.priority > bestMatch.priority) {
          console.log(`[nicheExtractor] Found match: "${segment}" → "${entry.niche}" (priority: ${entry.priority})`);
          bestMatch = entry;
        }
      }
    }
  }

  if (bestMatch) {
    console.log(`[nicheExtractor] ✓ Final match: "${bestMatch.niche}" (priority: ${bestMatch.priority})`);
    return { hint: bestMatch.niche, isDirectMatch: true };
  }

  console.log('[nicheExtractor] No niche match found');
  return { hint: null, isDirectMatch: false };
}

/**
 * Extract niche from a creator profile object
 * Checks both URL and bio text
 * @param {object} creator - Creator profile object with url/profile_url and bio properties
 * @returns {string|null} Niche hint or null
 */
function extractNicheFromCreator(creator) {
  if (!creator) return null;

  // Try URL first (more reliable)
  const profileUrl = creator.url || creator.profile_url;
  if (profileUrl) {
    const urlResult = extractNicheHintFromUrl(profileUrl);
    if (urlResult.hint) {
      return urlResult.hint;
    }
  }

  // Fall back to bio
  const bio = creator.bio || creator.description || '';
  if (bio) {
    const bioResult = extractNicheHintFromUrl(bio);
    if (bioResult.hint) {
      return bioResult.hint;
    }
  }

  return null;
}

module.exports = {
  extractNicheHintFromUrl,
  extractNicheFromCreator,
};
