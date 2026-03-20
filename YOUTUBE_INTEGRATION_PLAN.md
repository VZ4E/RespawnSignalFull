# YouTube Integration Plan for RespawnSignal

## Overview
Integrate the YouTube brand-deal scanner into the existing multi-platform RespawnSignal app. The YouTube pipeline (youtubeService + youtubeScanner) is ready and needs to be wired into:
1. Backend routes
2. Frontend UI (unified input + platform selector)
3. Results display

---

## Phase 1: Backend Integration

### 1.1 Add YouTube Route Handler
**File:** `src/routes/youtube.js` (NEW)

```javascript
const express = require('express');
const router = express.Router();
const { fetchChannelData } = require('../services/youtubeService');
const { runYoutubeScan } = require('../services/youtubeScanner');
const { supabase } = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

// POST /api/youtube/scan
router.post('/scan', authMiddleware, async (req, res) => {
  const { channelInput, scanDepth = 10 } = req.body;

  if (!channelInput || typeof channelInput !== 'string' || !channelInput.trim()) {
    return res.status(400).json({ error: 'channelInput is required' });
  }

  const { dbUser, planConfig } = req;

  // Block if no plan
  if (!dbUser.plan || dbUser.plan === 'none') {
    return res.status(403).json({ error: 'No active plan. Please subscribe to start scanning.' });
  }

  // Check credits (YouTube scans are ~1 credit per video analyzed)
  if (dbUser.credits_remaining <= 0) {
    return res.status(402).json({ error: 'No credits remaining.' });
  }

  // Enforce scan depth by plan
  const safeDepth = Math.min(parseInt(scanDepth) || 10, planConfig.maxRange);

  // Check cache: same channel + depth within last 7 days
  const { data: existing } = await supabase
    .from('scans')
    .select('*')
    .eq('user_id', dbUser.id)
    .eq('platform', 'youtube')
    .eq('channel_input', channelInput.trim())
    .eq('scan_depth', safeDepth)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return res.json({
      cached: true,
      cachedAt: existing.created_at,
      ...existing,
    });
  }

  let scanResult;
  let creditsUsed = 0;

  try {
    // 1. Fetch channel data + videos
    const channelData = await fetchChannelData(channelInput.trim(), safeDepth);

    // 2. Run brand detection
    scanResult = await runYoutubeScan(channelData);

    // Calculate credits (1 per video analyzed)
    creditsUsed = Math.min(scanResult.videosAnalyzed, dbUser.credits_remaining);

  } catch (err) {
    console.error('[youtube route] Scan error:', err.message);

    if (err.message.includes('No YouTube channel found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('Could not parse YouTube channel')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('YouTube API error')) {
      return res.status(502).json({ error: 'YouTube API unavailable. Try again shortly.' });
    }

    return res.status(500).json({ error: 'Scan failed. Please try again.' });
  }

  try {
    // 3. Deduct credits (wrapped in try/finally for earlier robustness)
    if (creditsUsed > 0) {
      await supabase
        .from('users')
        .update({ credits_remaining: dbUser.credits_remaining - creditsUsed })
        .eq('id', dbUser.id);
    }
  } catch (creditErr) {
    console.error('[youtube route] Credit deduction failed:', creditErr);
    // Log but don't fail — scan completed, credit issue is separate
  }

  // 4. Persist scan to history
  const { data: scanRecord, error: insertError } = await supabase
    .from('scans')
    .insert({
      user_id: dbUser.id,
      platform: 'youtube',
      username: scanResult.channel.title,
      channel_name: scanResult.channel.title,
      channel_handle: scanResult.channel.handle,
      channel_input: channelInput.trim(),
      channel_thumbnail: scanResult.channel.thumbnailUrl,
      subscriber_count: scanResult.channel.subscriberCount,
      unique_brand_count: scanResult.uniqueBrandCount,
      total_deals_found: scanResult.totalDealsFound,
      videos_analyzed: scanResult.videosAnalyzed,
      videos_with_deals: scanResult.videosWithDeals,
      scan_depth: safeDepth,
      summary: scanResult.summary,
      deals: scanResult.brandsFound,
      unique_brands: scanResult.uniqueBrands,
      videos: scanResult.videos,
      credits_used: creditsUsed,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[youtube route] Scan insert failed:', insertError);
  }

  // 5. Respond with results
  return res.json({
    success: true,
    scanId: scanRecord?.id || null,
    platform: 'youtube',
    cached: false,
    channel: scanResult.channel,
    uniqueBrands: scanResult.uniqueBrands,
    totalDealsFound: scanResult.totalDealsFound,
    uniqueBrandCount: scanResult.uniqueBrandCount,
    videosAnalyzed: scanResult.videosAnalyzed,
    videosWithDeals: scanResult.videosWithDeals,
    summary: scanResult.summary,
    creditsUsed,
  });
});

module.exports = router;
```

### 1.2 Create YouTube Service Files

**File:** `src/services/youtubeService.js` (from your code)
**File:** `src/services/youtubeScanner.js` (from your code)

Copy the code blocks you provided directly. Make sure `.env` has:
```
YOUTUBE_API_KEY=<your-key>
PERPLEXITY_API_KEY=<your-key>
```

### 1.3 Mount Route in server.js

Update `server.js`:

```javascript
const youtubeRoutes = require('./src/routes/youtube');

// ... after other routes ...
app.use('/api/youtube', youtubeRoutes);
```

---

## Phase 2: Database Schema Update

### 2.1 Add YouTube Fields to `scans` Table

Run in Supabase SQL editor:

```sql
ALTER TABLE scans ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'tiktok';
ALTER TABLE scans ADD COLUMN IF NOT EXISTS channel_input TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS channel_name TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS channel_handle TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS channel_thumbnail TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS subscriber_count INTEGER DEFAULT 0;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS scan_depth INTEGER DEFAULT 10;

CREATE INDEX IF NOT EXISTS idx_scans_platform ON scans(platform);
CREATE INDEX IF NOT EXISTS idx_scans_platform_user ON scans(platform, user_id);
```

---

## Phase 3: Frontend Integration

### 3.1 Update Platform Selector

The 4-button platform selector is already in place:
```html
<button class="platform-selector active" data-platform="tiktok" ...>🎵 TikTok</button>
<button class="platform-selector" data-platform="youtube" ...>▶️ YouTube</button>
<button class="platform-selector" data-platform="instagram" ...>📸 Instagram</button>
<button class="platform-selector" data-platform="twitch" ...>🎮 Twitch</button>
```

**No changes needed** — already wired up.

### 3.2 Update Input Label & Placeholder

In the JavaScript (`<script>` section in `public/index.html`), update `selectPlatform()`:

```javascript
function selectPlatform(platform, btn) {
  // ... existing code ...

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
  
  // Update scan range label for YouTube
  if (platform === 'youtube') {
    document.getElementById('range-group').innerHTML = `
      <button class="range-btn active" onclick="setRange(10,this)">Last 10</button>
      <button class="range-btn" id="range-20" onclick="setRange(20,this)">Last 20</button>
      <button class="range-btn" id="range-30" onclick="setRange(30,this)">Last 30</button>
    `;
    setRange(10); // Reset to 10
  } else {
    // Restore TikTok ranges
    document.getElementById('range-group').innerHTML = `
      <button class="range-btn active" onclick="setRange(3,this)">Last 3</button>
      <button class="range-btn" id="range-14" onclick="setRange(14,this)">Last 14</button>
      <button class="range-btn" id="range-30" onclick="setRange(30,this)">Last 30</button>
    `;
    setRange(3);
  }
}
```

### 3.3 Update `startScan()` Function

Replace the existing `startScan()` to route by platform:

```javascript
async function startScan() {
  const platform = document.querySelector('.platform-selector.active')?.dataset.platform || 'tiktok';
  const input = document.getElementById('creator-input').value.trim();
  
  if (!input) {
    showError('Please enter a creator handle or URL');
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelInput: input,
          scanDepth: scanRange,
        }),
      });
    } else {
      // TikTok scan (existing logic)
      response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
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

### 3.4 Add Result Display Handler

Add this function to handle both TikTok and YouTube results:

```javascript
function displayScanResults(data, platform) {
  const resultsDiv = document.getElementById('scan-results');
  let html = '';

  if (platform === 'youtube') {
    // YouTube results
    const { channel, uniqueBrands, totalDealsFound, videosAnalyzed, summary } = data;

    html += `
      <div class="card" style="margin-top:20px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          ${channel.thumbnailUrl ? `<img src="${channel.thumbnailUrl}" style="width:48px;height:48px;border-radius:50%"/>` : ''}
          <div>
            <div style="font-weight:700">${channel.title}</div>
            <div style="font-size:12px;color:var(--text3)">
              ${channel.subscriberCount?.toLocaleString() || '—'} subscribers • ${videosAnalyzed} videos analyzed
            </div>
          </div>
        </div>
        <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;font-size:12px;color:var(--text2)">
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
            <div class="deal-co-label">${brand.brandName}</div>
            <div style="font-size:13px;color:var(--text2);margin-bottom:8px">
              ${brand.dealCount} appearance${brand.dealCount > 1 ? 's' : ''} •
              ${brand.dealTypes.join(', ')}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:8px">
              ${brand.promoCodes.length > 0 ? `<strong>Promo Codes:</strong> ${brand.promoCodes.join(', ')}<br/>` : ''}
            </div>
            <div style="max-height:120px;overflow-y:auto">
              ${brand.appearances.map(app => `
                <div style="font-size:11px;color:var(--text2);margin-bottom:6px;padding:6px;background:var(--surface2);border-radius:4px">
                  <strong>${app.videoTitle}</strong><br/>
                  <em>${app.evidenceSnippet}</em><br/>
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
    // TikTok results (existing code)
    // ... keep existing displayScanResults logic for TikTok ...
  }

  resultsDiv.innerHTML = html;
}
```

### 3.5 Update History Display

The existing `loadHistory()` function pulls from `/api/scans` which now includes `platform` field. Update the history display to show platform badge:

```javascript
function formatHistoryRow(scan) {
  const platform = scan.platform || 'tiktok';
  const platformEmoji = {
    tiktok: '🎵',
    youtube: '▶️',
    instagram: '📸',
    twitch: '🎮',
  }[platform] || '?';

  return `
    <div class="history-item">
      <div>
        <div class="hi-name">${platformEmoji} ${scan.username || scan.channel_name || 'Unknown'}</div>
        <div class="hi-meta">
          <span>${scan.range || scan.scan_depth || 'N/A'} videos</span>
          <span>${scan.deals?.length || 0} deals</span>
          <span>${formatDate(scan.created_at)}</span>
        </div>
      </div>
      <div class="hi-right">
        <div class="hi-deals">${scan.deals?.length || 0}</div>
      </div>
    </div>
  `;
}
```

---

## Phase 4: Testing Checklist

- [ ] **YouTube API key** in `.env` (from Google Cloud Console)
- [ ] **Perplexity API key** in `.env`
- [ ] Database migrations run (platform + YouTube fields added)
- [ ] Backend route registered in `server.js`
- [ ] Frontend platform selector wired up
- [ ] Test scan with:
  - Channel URL: `@LinusTechTips`
  - Channel ID: `UCXuqSBlHAE6Xw-yeJA7Ufg`
  - Full URL: `https://www.youtube.com/@LinusTechTips`
- [ ] Results display correctly with brands + appearances
- [ ] Scan history shows platform badge (▶️ YouTube)
- [ ] Credit deduction works
- [ ] Cache (7-day lookback) works

---

## Phase 5: Optional Enhancements

1. **Rate Limiting:** YouTube API has higher quotas than TikTok. Consider per-platform limits.
2. **Thumbnail Display:** Show channel thumbnail + subscriber count in results (already in response).
3. **Deep Linking:** Add `?platform=youtube&channel=@LinusTechTips` to pre-fill scanner.
4. **Bulk YouTube Scanning:** Add YouTube creators to the Automation tab.
5. **YouTube-Specific Metrics:** Show video views, likes, publish dates in results.

---

## Notes

- **Credit Calculation:** YouTube charges ~1 credit per video. TikTok is similar. Adjust in `startScan()` if needed.
- **Cache Strategy:** YouTube caches 7 days (much longer than TikTok's 1 day) since channels change less frequently.
- **Perplexity Accuracy:** Both YouTube and TikTok use Perplexity. If accuracy differs, tune the `temperature` or `max_tokens` in `youtubeScanner.js`.
- **Error Handling:** YouTube API errors are different from TikTok (channel not found vs user not found). Test error messages.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/routes/youtube.js` | CREATE | Backend route for YouTube scans |
| `src/services/youtubeService.js` | CREATE | YouTube API wrapper |
| `src/services/youtubeScanner.js` | CREATE | Perplexity brand detection for YouTube |
| `server.js` | MODIFY | Register YouTube route |
| `public/index.html` | MODIFY | Update `selectPlatform()` + `startScan()` + results display |
| `.env` | MODIFY | Add `YOUTUBE_API_KEY` + `PERPLEXITY_API_KEY` |
| SQL Migration | RUN | Add `platform` + YouTube fields to `scans` table |

---

Done! Ready to implement?
