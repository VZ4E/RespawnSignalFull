# Niche Matcher Flow Diagram

## How Priority-Based Matching Works

### Input → Processing → Output

```
┌─────────────────────────────────────────────────────────────────────┐
│ INPUT: URL String                                                   │
│ "https://tiktok.com/profiles/gaming/fortnite"                       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: NORMALIZE & SPLIT                                           │
│ • Remove protocol (https://)                                        │
│ • Split on path separators (/, ?, &, #)                             │
│ • Filter empty strings                                              │
│                                                                     │
│ Result: ["tiktok.com", "profiles", "gaming", "fortnite"]            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: ITERATE ALL SEGMENTS & CHECK AGAINST PRIORITY MAP           │
│                                                                     │
│ For each segment in ["tiktok.com", "profiles", "gaming", "fortnite"]:
│   └─ "tiktok.com" → Not in map (skip)                              │
│   └─ "profiles"   → Not in map (skip)                              │
│   └─ "gaming"     → MATCH! priority=1, "Variety Gaming"            │
│   └─ "fortnite"   → MATCH! priority=10, "Fortnite/Battle Royale"   │
│                                                                     │
│ Track: bestMatch = { priority: 10, niche: "Fortnite/..." }         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: RETURN HIGHEST PRIORITY MATCH                               │
│                                                                     │
│ Matches found:                                                      │
│   1. "gaming"    (priority: 1) ✗ Lower priority                     │
│   2. "fortnite"  (priority: 10) ✓ HIGHEST PRIORITY                  │
│                                                                     │
│ Winner: { hint: "Fortnite/Battle Royale", isDirectMatch: true }    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ OUTPUT: Niche Result Object                                         │
│ {                                                                   │
│   hint: "Fortnite/Battle Royale",                                   │
│   isDirectMatch: true                                               │
│ }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Priority Hierarchy

```
PRIORITY 10 (Most Specific - Specific Games)
├─ Fortnite
├─ Valorant
├─ Counter-Strike (CS:GO, CS2)
├─ Apex Legends
├─ Warzone
└─ Genshin Impact
    │
    │ (Only if higher priority not found)
    ▼
PRIORITY 9 (Specific Titles & Platform)
├─ Minecraft
├─ Roblox
├─ Twitch Streaming
└─ Athletes/Sports
    │
    │ (Only if higher priority not found)
    ▼
PRIORITY 8 (Game Categories)
├─ FPS/Competitive Gaming
├─ Sandbox/Creative
└─ Fitness
    │
    │ (Only if higher priority not found)
    ▼
PRIORITY 7 (Content Types)
├─ Entertainment
└─ Content Creators
    │
    │ (Only if higher priority not found)
    ▼
PRIORITY 6 (Broader Categories)
├─ Influencers
└─ Lifestyle/IRL
    │
    │ (Only if no higher priority found)
    ▼
PRIORITY 1 (Generic Fallback - Only if specific not found)
└─ Gaming/Gamers
```

## Example Comparisons

### Example 1: Gaming + Fortnite
```
URL: profiles/gaming/fortnite

Matches found:
  "gaming"    → priority 1 ("Variety Gaming")
  "fortnite"  → priority 10 ("Fortnite/Battle Royale")

Winner: "Fortnite/Battle Royale" ✅
  (higher priority)
```

### Example 2: FPS + Valorant
```
URL: profiles/fps/valorant

Matches found:
  "fps"       → priority 8 ("FPS/Competitive Gaming")
  "valorant"  → priority 10 ("Valorant/Tactical FPS")

Winner: "Valorant/Tactical FPS" ✅
  (higher priority)
```

### Example 3: Fitness + Athlete
```
URL: profiles/fitness/athlete

Matches found:
  "fitness"   → priority 8 ("Fitness/Gaming")
  "athlete"   → priority 9 ("Athlete/Sports")

Winner: "Athlete/Sports" ✅
  (higher priority)
```

### Example 4: Only Generic Match
```
URL: profiles/streaming/content

Matches found:
  "streaming" → priority 9 ("Twitch Streaming/Content Creator")
  "content"   → priority 7 ("Content Creator")

Winner: "Twitch Streaming/Content Creator" ✅
  (highest priority among available matches)
```

### Example 5: No Match
```
URL: profiles/random/profile

No matches found → { hint: null, isDirectMatch: false }
```

## Code Logic (Simplified)

```javascript
function extractNicheHintFromUrl(url) {
  // 1. Normalize and split
  const segments = normalizeUrl(url).split('/');
  
  // 2. Define priority map (highest priority first)
  const nicheMap = [
    { keywords: ['fortnite'], priority: 10 },
    { keywords: ['valorant'], priority: 10 },
    // ... more entries ...
    { keywords: ['gaming'], priority: 1 },  // Generic fallback
  ];
  
  // 3. Find ALL matches, track highest priority
  let bestMatch = null;
  
  for (const segment of segments) {
    for (const entry of nicheMap) {
      if (entry.keywords.includes(segment)) {
        // Keep this match if it has HIGHER priority than current best
        if (!bestMatch || entry.priority > bestMatch.priority) {
          bestMatch = entry;  // ✅ This is the key difference!
        }
      }
    }
  }
  
  // 4. Return highest priority or null
  return bestMatch ? { hint: bestMatch.niche } : { hint: null };
}
```

**Key insight**: The loop doesn't return on first match. It checks ALL segments and keeps the HIGHEST priority match.

## What This Solves

### ❌ Old Approach (First Match Wins)
```javascript
for (const segment of segments) {
  if (segment === 'gaming') return 'Variety Gaming';    // ← Stops here!
  if (segment === 'fortnite') return 'Fortnite';        // ← Never reached
}
```

**Problem**: Gaming is earlier in the URL, so it matches first.

### ✅ New Approach (Highest Priority Wins)
```javascript
let best = null;
for (const segment of segments) {
  if (segment === 'gaming' && 1 > best?.priority) best = gaming;      // ← Checks priority
  if (segment === 'fortnite' && 10 > best?.priority) best = fortnite;  // ← 10 > 1, wins!
}
return best;  // Fortnite (priority 10) wins!
```

**Solution**: Evaluates all matches and returns the one with highest priority score.

## Testing the Flow

```bash
# Run test suite to verify all priority matching works correctly
node test-nicheExtractor.js

# Expected output:
# ✅ PASS: Fortnite should match BEFORE gaming (higher priority)
# 🎉 All tests passed!
```

## Integration Points

### Where It Fits in Scan Pipeline

```
1. User submits scan request
   ↓
2. Fetch creator profile data
   ├─ username/handle
   ├─ platform (TikTok/YouTube/etc)
   └─ profile_url ◄──────────────┐
   ↓                              │
3. 📍 CALL nicheExtractor ────────┘
   │
   ├─ Input: profile_url
   ├─ Process: priority matching
   └─ Output: niche_hint
   ↓
4. Fetch videos & analyze deals
   ↓
5. Save scan record (with niche_hint) to DB
   ↓
6. Return results to frontend
   (including niche for display)
```

## Performance

- **Time complexity**: O(n × m) where n = URL segments, m = niche entries
  - Typical: ~5 segments × 20 entries = 100 operations (instant)
- **Memory**: Niche map loaded once at module init
- **No external APIs**: Pure string matching
