# YouTube Integration Implementation Checklist

Use this checklist to track your integration progress.

---

## 🔧 SETUP PHASE (15 minutes)

### Get API Keys
- [ ] **YouTube API Key**
  - [ ] Go to https://console.cloud.google.com
  - [ ] Create project (or select existing)
  - [ ] Enable "YouTube Data API v3"
  - [ ] Create API Key credential
  - [ ] Copy key to clipboard

- [ ] **Perplexity API Key**
  - [ ] Go to https://www.perplexity.ai/api
  - [ ] Sign up or log in
  - [ ] Create API key
  - [ ] Copy key to clipboard

### Add Environment Variables
- [ ] Open `.env` file
- [ ] Add: `YOUTUBE_API_KEY=<your-key>`
- [ ] Add: `PERPLEXITY_API_KEY=<your-key>`
- [ ] Save file
- [ ] **Restart backend** (important!)

---

## 📂 BACKEND PHASE (10 minutes)

### Copy Service Files
- [ ] Copy `src/services/youtubeService.js` to your repo
- [ ] Copy `src/services/youtubeScanner.js` to your repo
- [ ] Copy `src/routes/youtube.js` to your repo
- [ ] Verify all 3 files exist in correct locations

### Register Route
- [ ] Open `server.js`
- [ ] Add: `const youtubeRoutes = require('./src/routes/youtube');`
- [ ] Add: `app.use('/api/youtube', youtubeRoutes);`
- [ ] Save file

### Test Backend
- [ ] Restart backend: `npm start`
- [ ] Check console for errors (should not see any)
- [ ] Verify no "Cannot find module" errors

---

## 💾 DATABASE PHASE (5 minutes)

### Run Migration
- [ ] Open Supabase console
- [ ] Go to SQL Editor
- [ ] Paste the SQL from **YOUTUBE_SETUP_GUIDE.md** (Section: "Update Database Schema")
- [ ] Click "Run"
- [ ] Verify success (no errors in output)

### Verify Schema
- [ ] Go to Tables → scans
- [ ] Scroll right to find columns:
  - [ ] `platform` (text, default 'tiktok')
  - [ ] `channel_name` (text)
  - [ ] `channel_input` (text)
  - [ ] `scan_depth` (integer)
  - [ ] `subscriber_count` (integer)
- [ ] Verify indexes created:
  - [ ] `idx_scans_platform`
  - [ ] `idx_scans_platform_user`

---

## 🎨 FRONTEND PHASE (20 minutes)

### Update HTML/JS
- [ ] Open `public/index.html`
- [ ] Search for `function selectPlatform(platform, btn) {`
- [ ] Replace entire function with code from **YOUTUBE_QUICK_COPY.md** (Section 4a)
- [ ] Search for `async function startScan() {`
- [ ] Replace entire function with code from **YOUTUBE_QUICK_COPY.md** (Section 4b)
- [ ] Find empty space in `<script>` section
- [ ] Add `displayScanResults()` function from **YOUTUBE_QUICK_COPY.md** (Section 4c)
- [ ] Save file

### Verify UI
- [ ] Refresh browser (Ctrl+Shift+R to force reload)
- [ ] Look for 4 platform buttons: 🎵 🎮 📸 ▶️
- [ ] Click ▶️ (YouTube button)
- [ ] Input label should change to "YouTube"
- [ ] Placeholder should change to YouTube-specific text
- [ ] Scan range buttons should show "Last 10/20/30"

---

## 🧪 TESTING PHASE (15 minutes)

### Test with cURL (Isolated)
- [ ] Open terminal/PowerShell
- [ ] Run: 
  ```bash
  curl -X POST http://localhost:3000/api/youtube/scan \
    -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"channelInput":"@LinusTechTips","scanDepth":10}'
  ```
  (Replace `YOUR_AUTH_TOKEN` with a real token from your browser's localStorage)
- [ ] Response should be JSON with `"success": true`
- [ ] Check for errors in response

### Test in Browser UI
- [ ] Open app in browser
- [ ] Log in (if not already)
- [ ] Click ▶️ YouTube platform button
- [ ] Enter channel: `@LinusTechTips`
- [ ] Click "Scan for Brand Deals"
- [ ] Wait 5-10 seconds
- [ ] Should show:
  - [ ] Channel name: "Linus Tech Tips"
  - [ ] Subscriber count
  - [ ] "Brands Found" count
  - [ ] List of brands with details
  - [ ] Credit deduction shown (-10)

### Test Error Cases
- [ ] Enter invalid handle: `@InvalidChannelName123456`
  - [ ] Should show: "No YouTube channel found"
- [ ] Log out and try to scan
  - [ ] Should show: "No active plan. Please subscribe"
- [ ] Use up all credits, try to scan
  - [ ] Should show: "No credits remaining"

### Test Caching
- [ ] Scan `@LinusTechTips` again with same depth
- [ ] Should show `"cached": true` in network inspector
- [ ] Should be instant (no loading spinner)

### Test History
- [ ] Go to "Scan History" page
- [ ] Verify YouTube scans show ▶️ badge
- [ ] Verify channel name, deal count, and date are correct
- [ ] Click on a YouTube scan to expand details

---

## ✅ VERIFICATION PHASE (5 minutes)

### Data Integrity
- [ ] Scan shows 5+ brands (if channel has deals)
- [ ] Each brand shows multiple appearances (if found in multiple videos)
- [ ] Promo codes extracted correctly (if any)
- [ ] Links to YouTube videos are correct

### Credits Working
- [ ] Check profile/credits page before scan
- [ ] Scan 1 video (10 credits deducted)
- [ ] Verify credit count decreased by 10
- [ ] Scan same channel again (cached, 0 credits deducted)
- [ ] Verify credit count unchanged

### No Errors
- [ ] Browser console (F12) shows no red errors
- [ ] Backend logs show no exceptions
- [ ] Database operations succeeded (check Supabase logs)

---

## 🚀 DEPLOYMENT PHASE (5 minutes)

### Before Going Live
- [ ] Remove test data from database (if needed)
- [ ] Verify production API keys are valid
- [ ] Test with 3-5 different real channels
- [ ] Check error handling with edge cases

### Deploy
- [ ] Commit all changes to git
- [ ] Push to production branch
- [ ] Deploy backend (Heroku/Vercel/etc)
- [ ] Deploy frontend (same or separate)
- [ ] Verify production environment has API keys

### Post-Deploy Monitoring
- [ ] Monitor error logs for first hour
- [ ] Check for API quota issues
- [ ] Verify credit deductions in production
- [ ] Get user feedback on first scans

---

## 📋 OPTIONAL ENHANCEMENTS (After Launch)

### Short-term
- [ ] Add Instagram scanner (same pattern)
- [ ] Add deep linking support (`?platform=youtube&channel=...`)
- [ ] Add YouTube creators to Automation page
- [ ] Display video metrics (views, likes, upload date)

### Medium-term
- [ ] Reverse lookup: "Which creators sponsor Brand X?"
- [ ] Deal trends: "Most-sponsored brands this month"
- [ ] Video grouping in results

### Long-term
- [ ] Real-time monitoring (webhook on new uploads)
- [ ] Public API for third-party access
- [ ] CSV export of results

---

## 🆘 TROUBLESHOOTING

If something doesn't work, check these in order:

### Backend Issues
- [ ] `.env` has both API keys
- [ ] Backend restarted after `.env` change
- [ ] `server.js` registers `/api/youtube` route
- [ ] All 3 service files exist
- [ ] No console errors when backend starts

### Database Issues
- [ ] SQL migration ran without errors
- [ ] `scans` table has `platform` column
- [ ] User has active plan (check `users` table)
- [ ] User has credits > 0

### Frontend Issues
- [ ] Browser cache cleared (Ctrl+Shift+R)
- [ ] `selectPlatform()` function updated
- [ ] `startScan()` function updated
- [ ] `displayScanResults()` function added
- [ ] YouTube button selected shows correct placeholders

### API Issues
- [ ] YouTube API key valid (test in Google Cloud)
- [ ] YouTube API v3 enabled in Google Cloud
- [ ] Perplexity API key valid (test their docs)
- [ ] Rate limits not exceeded (check dashboards)

### Network Issues
- [ ] Can reach Google APIs from your server
- [ ] Can reach Perplexity API from your server
- [ ] Can reach Supabase from your server
- [ ] Firewall not blocking outbound HTTPS

---

## ✨ Success Criteria

You've successfully integrated YouTube when:

✅ YouTube platform button works  
✅ Can scan real YouTube channels  
✅ Results show brands + appearances  
✅ Credits deduct correctly  
✅ Caching works (7-day lookback)  
✅ History shows YouTube scans  
✅ No errors in logs  
✅ Users can run multiple scans  

---

## Need Help?

1. **Check the docs:**
   - `YOUTUBE_SETUP_GUIDE.md` — detailed walkthrough
   - `YOUTUBE_INTEGRATION_PLAN.md` — full technical design
   - `YOUTUBE_QUICK_COPY.md` — code snippets

2. **Check error messages:**
   - Browser console (F12)
   - Backend logs (terminal)
   - Supabase logs (SQL Editor)

3. **Test in isolation:**
   - Use cURL to test API directly
   - Check environment variables
   - Verify API keys are valid

---

## 🎉 You're Done!

Once all items are checked, YouTube scanning is live and ready for users. Congratulations! 🚀

**Next:** Monitor logs for first 24 hours, then consider Instagram/Twitch integration using the same pattern.
