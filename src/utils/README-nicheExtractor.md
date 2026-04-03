# Niche Extractor Utility

## Overview

The `nicheExtractor` module provides intelligent extraction of creator "niches" from profile URLs and bios using a **priority-based matching system**.

## Problem It Solves

The previous implementation would greedily match the first niche keyword found, causing issues like:

```
URL: profiles/gaming/fortnite
Old behavior: Matches "gaming" first → "Variety Gaming" ❌
New behavior: Checks all segments, returns highest priority → "Fortnite/Battle Royale" ✅
```

## How It Works

### Priority System

The matcher iterates through **all URL segments**, collects all matches, then returns the match with the **highest priority**:

**Priority Levels (10 = highest specificity):**
- **10** — Specific games (Fortnite, Valorant, Counter-Strike, Genshin, etc.)
- **9** — Specific titles & categories (Minecraft, Roblox, Twitch Streaming, Athletes)
- **8** — Competitive/FPS, Sandbox, Fitness
- **7** — Entertainment, Content Creators
- **6** — Influencers, Lifestyle
- **1** — Generic fallback (Gaming, Gamers)

### Examples

```javascript
const { extractNicheHintFromUrl } = require('./nicheExtractor');

// Specific games win over generic categories
extractNicheHintFromUrl('https://tiktok.com/profiles/gaming/fortnite')
// → { hint: 'Fortnite/Battle Royale', isDirectMatch: true }

// Ranked competitive FPS specifics beat generic FPS
extractNicheHintFromUrl('https://tiktok.com/profiles/fps/valorant')
// → { hint: 'Valorant/Tactical FPS', isDirectMatch: true }

// Athlete beats fitness
extractNicheHintFromUrl('https://tiktok.com/profiles/fitness/athlete')
// → { hint: 'Athlete/Sports', isDirectMatch: true }

// Minecraft is specific
extractNicheHintFromUrl('https://tiktok.com/profiles/minecraft')
// → { hint: 'Minecraft/Sandbox', isDirectMatch: true }

// No match returns null
extractNicheHintFromUrl('https://tiktok.com/@random_creator')
// → { hint: null, isDirectMatch: false }
```

## API

### `extractNicheHintFromUrl(url: string)`

Extracts a niche hint from a URL or text string.

**Parameters:**
- `url` (string) — A creator profile URL or bio text

**Returns:**
```javascript
{
  hint: string | null,        // The matched niche name, or null
  isDirectMatch: boolean      // Whether this was an explicit match (true) or default (false)
}
```

### `extractNicheFromCreator(creator: object)`

Convenience function that extracts niche from a creator profile object.

**Parameters:**
- `creator` (object) — Creator profile with `url` or `profile_url` and optional `bio`/`description`

**Returns:**
- `string | null` — The matched niche name

**Example:**
```javascript
const creator = {
  name: 'FortnitePro',
  url: 'https://tiktok.com/profiles/gaming/fortnite',
  bio: 'Competitive Fortnite player'
};

const niche = extractNicheFromCreator(creator);
// → 'Fortnite/Battle Royale'
```

## Integration with Scan Routes

To integrate with the scan routes, add after fetching creator data:

```javascript
const { extractNicheFromCreator } = require('../utils/nicheExtractor');

// After fetching creator info
const niche = extractNicheFromCreator(creatorData);

// Store in scan results
const scanRecord = {
  creator_handle: username,
  niche_hint: niche,
  deals: deals,
  // ... other fields
};
```

## Testing

Run the test suite:

```bash
cd respawn-signal-repo
node ../test-nicheExtractor.js
```

**Expected output:**
```
═══════════════════════════════════════════════════════════
RESULTS: 10 passed, 0 failed out of 10
🎉 All tests passed!
═══════════════════════════════════════════════════════════
```

## Adding New Niches

To add a new niche or adjust priorities, edit the `nicheMap` array in `nicheExtractor.js`:

```javascript
const nicheMap = [
  // Add high-priority matches first
  { keywords: ['newgame'], niche: 'New Game Name', priority: 10 },
  // ... existing entries ...
];
```

**Key principles:**
1. **Most specific first** — Game titles before generic categories
2. **Priority matters** — Higher numbers win in conflicts
3. **Keyword matching is exact** — `'valorant'` won't match `'valorant-pro'`
4. **Single keyword per entry** — Easier to understand and maintain

## Logging

The module includes debug logging:

```javascript
[nicheExtractor] Normalized URL segments: tiktok.com -> profiles -> gaming -> fortnite
[nicheExtractor] Found match: "fortnite" → "Fortnite/Battle Royale" (priority: 10)
[nicheExtractor] ✓ Final match: "Fortnite/Battle Royale" (priority: 10)
```

Enable via `console.log` output during development.
