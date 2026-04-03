# Integration Example: Using Niche Extractor in Scan Routes

This shows how to add niche extraction to your existing scan endpoints.

## Step 1: Import the Module

At the top of `src/routes/scan.js`, add:

```javascript
const { extractNicheFromCreator } = require('../utils/nicheExtractor');
```

## Step 2: Extract Niche After Getting Creator Data

When you fetch creator info (from TikTok/YouTube/etc.), extract their niche:

```javascript
// After fetching creator data
const creatorData = {
  url: 'https://tiktok.com/profiles/gaming/fortnite',
  bio: 'Competitive Fortnite streamer'
};

const niche = extractNicheFromCreator(creatorData);
// niche = 'Fortnite/Battle Royale'
```

## Step 3: Include in Scan Record

When saving scan results to Supabase, add the niche:

```javascript
const { error: insertError } = await supabase.from('scans').insert({
  user_id: dbUser.id,
  username,
  platform: platform || 'tiktok',
  range: safeRange,
  video_count: videos.length,
  credits_used: creditsToDeduct,
  deals,
  videos: videosList,
  niche_hint: niche,  // ← ADD THIS
});
```

## Example in Context

### Original Code (POST /api/scan)
```javascript
// 5. Save scan record with video list + transcripts for re-analysis
const videosList = withTranscripts.map(v => ({
  title: v.title,
  videoId: v.videoId,
  desc: v.title,
  transcript: v.transcript,
  views: v.views,
}));

const { error: insertError } = await supabase.from('scans').insert({
  user_id: dbUser.id,
  username,
  platform: platform || 'tiktok',
  range: safeRange,
  video_count: videos.length,
  credits_used: creditsToDeduct,
  deals,
  videos: videosList,
});
```

### Updated Code (with Niche)
```javascript
const { extractNicheFromCreator } = require('../utils/nicheExtractor');

// ... earlier in function, fetch creator profile URL ...
const creatorUrl = `https://www.${platform}.com/@${username}`;  // Example URL
const niche = extractNicheFromCreator({ url: creatorUrl });

// 5. Save scan record with niche
const videosList = withTranscripts.map(v => ({
  title: v.title,
  videoId: v.videoId,
  desc: v.title,
  transcript: v.transcript,
  views: v.views,
}));

const { error: insertError } = await supabase.from('scans').insert({
  user_id: dbUser.id,
  username,
  platform: platform || 'tiktok',
  range: safeRange,
  video_count: videos.length,
  credits_used: creditsToDeduct,
  deals,
  videos: videosList,
  niche_hint: niche,  // ← NEW
});
```

## Step 4: (Optional) Add Database Column

If you want to store niche in the scans table:

```sql
ALTER TABLE scans ADD COLUMN niche_hint VARCHAR(100);
CREATE INDEX idx_scans_niche ON scans(niche_hint);
```

Then you can query by niche:
```javascript
// Find all Fortnite creators
const { data } = await supabase
  .from('scans')
  .select('*')
  .eq('user_id', userId)
  .eq('niche_hint', 'Fortnite/Battle Royale');
```

## Step 5: Return Niche in API Response

Update the API response to include niche:

```javascript
return res.json({
  videos: withTranscripts,
  deals,
  niche: niche,  // ← ADD THIS
  creditsUsed: creditsToDeduct,
  analysisError,
  transcriptFailures,
});
```

## Frontend Integration

On the frontend, display the niche in the scan results:

```javascript
// In your scan results handler
const scanResult = await api('/api/scan', 'POST', { ... });

console.log(`Found ${scanResult.niche} creator with ${scanResult.deals.length} deals`);
// Output: "Found Fortnite/Battle Royale creator with 3 deals"
```

## Testing the Integration

1. Trigger a scan with a URL containing both generic and specific terms:
   ```
   https://tiktok.com/profiles/gaming/fortnite
   ```

2. Check the console/logs for:
   ```
   [nicheExtractor] Normalized URL segments: tiktok.com -> profiles -> gaming -> fortnite
   [nicheExtractor] Found match: "fortnite" → "Fortnite/Battle Royale" (priority: 10)
   [nicheExtractor] ✓ Final match: "Fortnite/Battle Royale" (priority: 10)
   ```

3. Verify the scan record includes:
   ```json
   {
     "username": "example",
     "niche_hint": "Fortnite/Battle Royale",
     "deals": [...]
   }
   ```

## Adding Custom Niches

To add more niches, edit `src/utils/nicheExtractor.js`:

```javascript
const nicheMap = [
  // ... existing entries ...
  { keywords: ['mygame'], niche: 'My Game Title', priority: 10 },
  { keywords: ['category'], niche: 'My Category', priority: 8 },
];
```

Then run tests to verify:
```bash
node test-nicheExtractor.js
```

## Troubleshooting

**Niche not matching?**
1. Check console logs for matching process
2. Verify keyword is in `nicheMap` in `nicheExtractor.js`
3. Ensure priority is correct (higher = more specific)
4. Run the test suite: `node test-nicheExtractor.js`

**Want to change priority?**
Edit the `priority` field in `nicheMap`:
```javascript
{ keywords: ['minecraft'], niche: 'Minecraft/Sandbox', priority: 9 }
                                                                      ↑
                                                      Change this number
```

**Adding bulk niches?**
Keep them in order from most specific (priority 10) to generic (priority 1) for readability.
