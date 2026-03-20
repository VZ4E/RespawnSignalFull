# YouTube Integration Setup Guide

This guide walks through integrating YouTube brand-deal scanning into RespawnSignal.

## What Was Done

✅ **Backend Created:**
- `src/services/youtubeService.js` — YouTube Data API wrapper
- `src/services/youtubeScanner.js` — Perplexity brand detection
- `src/routes/youtube.js` — Express route handler

✅ **Integration Plan Created:**
- `YOUTUBE_INTEGRATION_PLAN.md` — full technical guide with code snippets

---

## Quick Setup (5 Steps)

### Step 1: Get API Keys

#### YouTube API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **YouTube Data API v3**
4. Create an **API Key** credential (not OAuth)
5. Copy the key

#### Perplexity API Key
1. Go to [Perplexity API](https://www.perplexity.ai/api)
2. Sign up / log in
3. Create an API key
4. Copy the key

### Step 2: Update `.env`

Add to `.env`:
```
YOUTUBE_API_KEY=your_youtube_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

### Step 3: Register the Route

In `server.js`, add:
```javascript
const youtubeRoutes = require('./src/routes/youtube');

// ... after other route registrations ...
app.use('/api/youtube', youtubeRoutes);
```

Full example (lines should go after existing routes):
```javascript
const authRoutes = require('./src/routes/auth');
const billingRoutes = require('./src/routes/billing');
const scanRoutes = require('./src/routes/scan');
const creatorRoutes = require('./src/routes/creators');
const configRoutes = require('./src/routes/configs');
const youtubeRoutes = require('./src/routes/youtube');  // ← NEW

// ...

app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/scan', scanLimiter, scanRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/configs', configRoutes);
app.use('/api/youtube', youtubeRoutes);  // ← NEW
```

### Step 4: Update Database Schema

Run in Supabase SQL editor:

```sql
-- Add platform field to scans table
ALTER TABLE scans ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'tiktok';

-- Add YouTube-specific fields
ALTER TABLE scans ADD COLUMN IF NOT EXISTS channel_name TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS channel_handle TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS channel_input TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS channel_thumbnail TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS subscriber_count INTEGER DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS scan_depth INTEGER DEFAULT 10;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scans_platform ON scans(platform);
CREATE INDEX IF NOT EXISTS idx_scans_platform_user ON scans(platform, user_id);
```

### Step 5: Update Frontend

In `public/index.html`, find the `selectPlatform()` function and update it to handle YouTube ranges differently:

**Replace the `selectPlatform()` function** (around line 2650 or search for `function selectPlatform`):

```javascript
function selectPlatform(platform, btn) {
  document.querySelectorAll('.platform-selector').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const labels = {
    tiktok: '@handle or TikTok URL',
    youtube: '@handle, channel ID, or YouTube URL',
    instagram: '@handle or Instagram URL',
    twitch: '@handle or Twitch URL',
  };

  const placeholders = {
    tiktok: '@hotrodd, https://tiktok.com/@hotrodd',
    youtube: '@LinusTechTips, UCxxxxx, https://youtube.com/@LinusTechTips',
    instagram: '@nasa, https://instagram.com/nasa',
    twitch: '@ninja, https://twitch.tv/ninja',
  };

  document.getElementById('input-label').textContent = labels[platform] || 'Creator Profile';
  document.getElementById('creator-input').placeholder = placeholders[platform] || 'Enter username or URL';
  
  // Update scan range options for YouTube
  if (platform === 'youtube') {
    document.getElementById('range-group').innerHTML = `
      <button class="range-btn active" onclick="setRange(10,this)">Last 10</button>
      <button class="range-btn" id="range-20" onclick="setRange(20,this)">Last 20</button>
      <button class="range-btn" id="range-30" onclick="setRange(30,this)">Last 30</button>
    `;
    scanRange = 10;
  } else {
    // Restore TikTok ranges
    document.getElementById('range-group').innerHTML = `
      <button class="range-btn active" onclick="setRange(3,this)">Last 3</button>
      <button class="range-btn" id="range-14" onclick="setRange(14,this)">Last 14</button>
      <button class="range-btn" id="range-30" onclick="setRange(30,this)">Last 30</button>
    `;
    scanRange = 3;
  }
}
```

**Update the `startScan()` function** (around line 2700) to route by platform:

```javascript
async function startScan() {
  const platform = document.querySelector('.platform-selector.active')?.dataset.platform || 'tiktok';
  const input = document.getElementById('creator-input').value.trim();
  
  if (!input) {
    const resultsDiv = document.getElementById('scan-results');
    resultsDiv.innerHTML = '<div class="err-bar">Please enter a creator handle or URL</div>';
    return;
  }

  const scanBtn = document.getElementById('scan-btn');
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';

  const resultsDiv = document.getElementById('scan-results');
  resultsDiv.innerHTML = '<div class="status-bar"><div class="pulse"></div>Analyzing videos...</div>';

  try {
    let response;

    if (platform === 'youtube') {
      // YouTube scan
      response = await fetch('/api/youtube/scan', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          channelInput: input,
          scanDepth: scanRange,
        }),
      });
    } else {
      // TikTok/Instagram/Twitch scan (existing)
      response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          platform,
          username: input,
          handle: input,
          range: scanRange,
        }),
      });
    }

    const data = await response.json();

    if (!response.ok) {
      resultsDiv.innerHTML = `<div class="err-bar">${data.error || 'Scan failed'}</div>`;
      return;
    }

    // Display results
    displayScanResults(data, platform);
    updateCreditsUI();
    loadHistory();

  } catch (err) {
    resultsDiv.innerHTML = `<div class="err-bar">Network error: ${err.message}</div>`;
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan for Brand Deals';
  }
}
```

**Add YouTube results display function** (add after the existing `startScan()` function):

```javascript
function displayScanResults(data, platform) {
  const resultsDiv = document.getElementById('scan-results');
  let html = '';

  if (platform === 'youtube') {
    // YouTube results
    const { channel, uniqueBrands, totalDealsFound, videosAnalyzed, summary, creditsUsed } = data;

    html += `
      <div class="card" style="margin-top:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          ${channel.thumbnailUrl ? `<img src="${channel.thumbnailUrl}" style="width:48px;height:48px;border-radius:50%;object-fit:cover"/>` : ''}
          <div style="flex:1">
            <div style="font-weight:700;margin-bottom:2px">${channel.title}</div>
            <div style="font-size:12px;color:var(--text3)">
              ${channel.subscriberCount?.toLocaleString() || '—'} subscribers • ${videosAnalyzed} videos
            </div>
          </div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--text2)">-${creditsUsed} credits</div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;font-size:12px;color:var(--text2);line-height:1.5">
          ${summary}
        </div>
      </div>

      <div class="results-hdr" style="margin-top:20px">
        <div class="results-title">Brands Found</div>
        <div class="count-pill">${totalDealsFound}</div>
      </div>
    `;

    if (uniqueBrands && uniqueBrands.length > 0) {
      uniqueBrands.forEach(brand => {
        html += `
          <div class="deal-card">
            <div class="brand-tags" style="margin-bottom:8px">
              <span class="brand-tag">${brand.brandName}</span>
            </div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:8px">
              ${brand.dealCount} appearance${brand.dealCount > 1 ? 's' : ''} •
              ${brand.dealTypes.join(', ')}
            </div>
            ${brand.promoCodes.length > 0 ? `
              <div style="font-size:11px;color:var(--text3);margin-bottom:8px;padding:6px;background:var(--accent-dim);border-radius:4px">
                <strong>Promo Codes:</strong> ${brand.promoCodes.join(', ')}
              </div>
            ` : ''}
            <div style="max-height:200px;overflow-y:auto;margin-top:8px">
              ${brand.appearances.map(app => `
                <div style="font-size:11px;color:var(--text2);margin-bottom:8px;padding:8px;background:var(--surface2);border-radius:4px">
                  <strong>${app.videoTitle}</strong><br/>
                  <em style="color:var(--text3);">"${app.evidenceSnippet}"</em><br/>
                  <a href="${app.videoUrl}" target="_blank" style="color:var(--accent);font-size:10px">View Video →</a>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
    } else {
      html += '<div class="no-results">No brand deals detected in these videos.</div>';
    }

  } else {
    // TikTok/other results (keep existing display)
    // Call your existing displayTikTokResults or similar
    displayTikTokResults(data, resultsDiv);
    return;
  }

  resultsDiv.innerHTML = html;
}
```

---

## Testing

### Test the YouTube Scanner Directly (cURL)

```bash
curl -X POST http://localhost:3000/api/youtube/scan \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channelInput": "@LinusTechTips",
    "scanDepth": 10
  }'
```

**Expected response:**
```json
{
  "success": true,
  "platform": "youtube",
  "channel": {
    "title": "Linus Tech Tips",
    "subscriberCount": 15000000,
    ...
  },
  "uniqueBrands": [...],
  "totalDealsFound": 5,
  ...
}
```

### Test in UI

1. Start backend: `npm start` or `node server.js`
2. Open app in browser
3. Select **YouTube** platform (▶️ button)
4. Enter channel: `@LinusTechTips` or `UCXuqSBlHAE6Xw-yeJA7Ufg`
5. Click **Scan for Brand Deals**
6. Wait ~10-20 seconds for results

---

## Troubleshooting

### "YouTube API error"
- ✅ Check `.env` has `YOUTUBE_API_KEY`
- ✅ Verify API key is valid in Google Cloud Console
- ✅ Check YouTube Data API v3 is **enabled** in project
- ✅ API key restrictions: make sure it's NOT restricted to HTTP referrers

### "No YouTube channel found"
- ✅ Check handle spelling (case-sensitive in some cases)
- ✅ Try using channel ID instead: `UCXuqSBlHAE6Xw-yeJA7Ufg`
- ✅ Try full URL: `https://www.youtube.com/@LinusTechTips`

### "Perplexity API error"
- ✅ Check `.env` has `PERPLEXITY_API_KEY`
- ✅ Verify API key is active in Perplexity dashboard
- ✅ Check rate limits not exceeded

### "No video descriptions available"
- Channel videos are private or age-restricted
- Try a public creator like `@MrBeast`

### Database Error: "Column 'platform' does not exist"
- ✅ Re-run the SQL migration in Step 4
- ✅ Verify the migration executed successfully in Supabase logs

---

## Files Changed

| File | Change |
|------|--------|
| `server.js` | Added YouTube route registration |
| `.env` | Added `YOUTUBE_API_KEY` + `PERPLEXITY_API_KEY` |
| `public/index.html` | Updated `selectPlatform()`, `startScan()`, `displayScanResults()` |
| **Supabase SQL** | Added `platform`, YouTube fields to `scans` table |

**New files:**
- `src/routes/youtube.js`
- `src/services/youtubeService.js`
- `src/services/youtubeScanner.js`

---

## Next Steps

- [ ] Deploy changes to production
- [ ] Monitor logs for errors
- [ ] Test with 5+ different YouTube channels
- [ ] Gather user feedback on accuracy
- [ ] Optional: add Instagram/Twitch scanners using same pattern

---

## Support

If you hit issues:
1. Check the logs: `tail -f server.log`
2. Verify API keys are active
3. Test with `curl` before testing in UI
4. Check database migration ran successfully
5. Restart backend after env changes

Good luck! 🎬
