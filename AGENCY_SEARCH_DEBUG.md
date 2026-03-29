# Agency Search - Find Agency Button Debug Guide

## Issue
The "Find Agency" button doesn't work

## Root Causes to Check

### 1. Authentication Token Missing/Invalid
The API requires a valid JWT token in localStorage.

**Check in Browser:**
1. Open DevTools (F12)
2. Go to Console tab
3. Run: `localStorage.getItem('rs_token')`
4. Should return a JWT token (long string starting with `eyJ...`)

**If empty:**
- You're not authenticated
- Solution: Log in first, then try Find Agency button

**If invalid:**
- Token is expired or malformed
- Solution: Log out and log back in

### 2. API Endpoint Not Responding
The `/api/agency-search/scrape` endpoint needs to be running.

**Check in Browser Console:**
```javascript
// Test if endpoint exists
fetch('/api/agency-search/scrape', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('rs_token')}`
  },
  body: JSON.stringify({ url: 'https://example.com' })
})
.then(r => r.json())
.then(console.log);
```

**Expected response:**
```json
{
  "error": "Invalid URL or no creators found",
  "details": "..."
}
```

Or success response with creators array.

### 3. Perplexity API Key Not Configured
The scrape endpoint uses Perplexity API to extract creator data.

**Check in Backend:**
1. Look at `.env` file
2. Verify `PERPLEXITY_KEY` is set
3. If empty, add your Perplexity API key

**If missing:**
- Backend will return 500 error
- Solution: Add PERPLEXITY_KEY to .env from https://www.perplexity.ai/api

### 4. Server Not Running
The backend API might not be running.

**Check:**
1. Is terminal showing `Respawn Signal running on port 3000`?
2. Run: `npm start`
3. Wait for server to start

## Step-by-Step Debug

### Step 1: Verify Authentication
```javascript
// In browser console (F12)
const token = localStorage.getItem('rs_token');
console.log('Token exists:', !!token);
console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'MISSING');
```

**Expected:** Token preview shows a long encoded string

### Step 2: Test API Directly
```javascript
// In browser console (F12)
const testUrl = 'https://respawnmedia.co'; // Test with real agency

fetch('/api/agency-search/scrape', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('rs_token')}`
  },
  body: JSON.stringify({ url: testUrl })
})
.then(r => {
  console.log('Status:', r.status);
  return r.json();
})
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
```

### Step 3: Check Server Logs
The backend should log what's happening:
```
[Agency Scrape] Starting scrape for URL: https://example.com
[Agency Scrape] Perplexity response: ...
```

Check terminal running `npm start` for these logs.

### Step 4: Check Network Tab
1. Open DevTools → Network tab
2. Click "Find Agency" button
3. Look for POST request to `/api/agency-search/scrape`
4. Click on it and check:
   - **Status**: Should be 200 (success) or error code
   - **Request Headers**: Should have Authorization header
   - **Response**: Should show creators or error message

## Common Error Messages

### 401 Unauthorized
**Cause:** Invalid or missing token
**Fix:** Log in again

### 403 Forbidden
**Cause:** Auth token invalid
**Fix:** Clear localStorage and log in again
```javascript
localStorage.clear();
location.reload();
```

### 500 Internal Server Error
**Cause:** Backend error (usually Perplexity API)
**Fix:** Check backend logs, verify PERPLEXITY_KEY

### "Please enter a URL"
**Cause:** Input field is empty
**Fix:** Enter a valid agency URL (e.g., https://respawnmedia.co)

### "Failed to scrape agency"
**Cause:** Couldn't extract creators from URL
**Possible fixes:**
- URL might not be an agency website
- Website structure not recognized by Perplexity
- Try with a known agency URL

## Environment Variables Needed

The backend requires these in `.env`:
```
PERPLEXITY_KEY=<your-api-key> ✓ (from https://www.perplexity.ai/api)
SUPABASE_URL=<your-project-url> ✓ (from Supabase dashboard)
SUPABASE_SERVICE_KEY=<your-service-key> ✓ (from Supabase dashboard)
```

Check `.env` file to verify they're set.

## Quick Fixes to Try

1. **Refresh page:** `F5` or `Ctrl+R`
2. **Clear cache:** `Ctrl+Shift+Delete` → Clear all
3. **Check server:** Restart with `npm start`
4. **Re-authenticate:** Log out and log back in
5. **Check browser console:** F12 → Console → Look for red errors

## Still Not Working?

If none of the above work:

1. Run in browser console:
```javascript
console.log('Token:', localStorage.getItem('rs_token'));
console.log('Location:', window.location.href);
console.log('API URL:', '/api/agency-search/scrape');
```

2. Check backend logs:
```bash
# In terminal where server is running
npm start
# Look for [Agency Scrape] logs
```

3. Test endpoint directly:
```bash
curl -X POST http://localhost:3000/api/agency-search/scrape \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Success Indicators

✅ Button click doesn't freeze UI
✅ "Please enter a URL" message appears if field empty
✅ Scraping starts (shows loading spinner)
✅ Creators appear in step 2
✅ Can select creators
✅ Can save agency

## File Locations

- **Frontend:** `public/index.html` (lines 5276-5450)
- **Backend:** `src/routes/agency-search.js`
- **Server:** `server.js`
- **Config:** `.env`
