# YouTube Integration — Copy/Paste Code Snippets

Use these exact snippets to integrate YouTube into RespawnSignal.

---

## 1. Update `server.js`

**Find this section:**
```javascript
const authRoutes = require('./src/routes/auth');
const billingRoutes = require('./src/routes/billing');
const scanRoutes = require('./src/routes/scan');
const creatorRoutes = require('./src/routes/creators');
const configRoutes = require('./src/routes/configs');
```

**Add this line:**
```javascript
const youtubeRoutes = require('./src/routes/youtube');
```

**Then find this section:**
```javascript
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/scan', scanLimiter, scanRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/configs', configRoutes);
```

**Add this line:**
```javascript
app.use('/api/youtube', youtubeRoutes);
```

---

## 2. Update `.env`

**Add these lines at the bottom:**
```
YOUTUBE_API_KEY=your_youtube_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

---

## 3. Run Database Migration

**Copy/paste into Supabase SQL editor and execute:**

```sql
-- Add platform tracking
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

---

## 4. Update `public/index.html`

### Find the `selectPlatform()` function

**Search for:** `function selectPlatform(platform, btn) {`

**Replace the entire function with:**

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

### Find the `startScan()` function

**Search for:** `async function startScan() {`

**Replace with:**

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

### Add the `displayScanResults()` function

**Find an empty spot in the `<script>` section (after `startScan()` is good)**

**Add this entire function:**

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

  } else if (platform === 'tiktok') {
    // Existing TikTok display — keep your existing code here
    // If you already have a displayTikTokResults function, call it:
    // displayTikTokResults(data, resultsDiv);
    // Otherwise, paste your existing startScan() results display code here
    html = '<div class="card">TikTok results would go here</div>';
  }

  resultsDiv.innerHTML = html;
}
```

---

## 5. Quick Test (cURL)

**Replace `YOUR_TOKEN` with an actual auth token, then run:**

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
  "channel": { ... },
  "uniqueBrands": [ ... ],
  "totalDealsFound": 5,
  "creditsUsed": 10
}
```

---

## 6. Verify Everything Works

✅ **Backend running?**
```bash
npm start
# or
node server.js
```

✅ **API keys in `.env`?**
```bash
cat .env | grep YOUTUBE
cat .env | grep PERPLEXITY
```

✅ **Database migration ran?**
Check Supabase: Tables → scans → verify `platform` column exists

✅ **Frontend changes applied?**
Open app in browser → Click YouTube platform button → Should show YouTube ranges + placeholder

✅ **Ready to scan?**
Click YouTube → Enter `@LinusTechTips` → Click "Scan for Brand Deals"

---

## Troubleshooting

### Error: "channelInput is required"
- Frontend is not sending the right field name
- Check that `startScan()` sends `channelInput` (not `username`)

### Error: "YouTube API error: 403"
- YouTube API is not enabled in Google Cloud Console
- Go to APIs & Services → Enable "YouTube Data API v3"

### Error: "No YouTube channel found"
- Handle doesn't exist or is misspelled
- Try with channel ID instead: `UCXuqSBlHAE6Xw-yeJA7Ufg`

### No results showing in UI
- Check browser console (F12) for JavaScript errors
- Verify `displayScanResults()` function was added
- Make sure it's being called from `startScan()`

### Credits not deducting
- Check `authMiddleware` is working (`req.dbUser` should exist)
- Verify database has `users` table with `credits_remaining`
- Check migration ran successfully

---

Done! You now have all the code you need. Just copy/paste and you're ready to launch YouTube scanning. 🚀
