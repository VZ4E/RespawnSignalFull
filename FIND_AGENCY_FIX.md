# Find Agency Button - Fix Guide

## The Problem

The "Find Agency" button in the Agency Search page doesn't work.

## Root Cause Diagnosis

### Test 1: Check if button exists in HTML
✅ **Status:** Button exists at line 1978
- Location: `public/index.html` line 1978
- HTML: `<button class="run-btn" onclick="showAgencySearchModal()">+ Find Agency</button>`

### Test 2: Check if JavaScript function exists
✅ **Status:** Function exists at line 5276
- Location: `public/index.html` line 5276
- Function: `function showAgencySearchModal()`

### Test 3: Check if modal HTML exists
✅ **Status:** Modal exists at line 2447
- Location: `public/index.html` line 2447
- ID: `agency-search-modal`

### Test 4: Check if endpoint is wired
✅ **Status:** Route is registered in server.js
- Route: `POST /api/agency-search/scrape`
- Status from Railway logs: **Working** (endpoint responds)

## The Real Issue

**One of these is happening:**

### Issue A: User Not Logged In
The `/api/agency-search/scrape` endpoint requires authentication.

**Check:**
1. Open browser
2. Look at top-right corner
3. See a user menu? → You're logged in ✅
4. No user menu? → Not logged in ❌

**Fix:** Log in first

### Issue B: JavaScript Error Blocking Everything
There might be a syntax error in the HTML that breaks the entire page.

**Check:**
1. Open DevTools: F12
2. Go to Console tab
3. Look for RED error messages
4. Copy the error

**Fix:** Depends on the error. Share it and I'll fix it.

### Issue C: Modal Hidden by CSS
The modal might be there but hidden by CSS.

**Check in DevTools Console:**
```javascript
document.getElementById('agency-search-modal').style.display
// Should return: 'flex' when button is clicked

// Try clicking manually:
showAgencySearchModal();
// Modal should appear
```

**Fix:** Check CSS variables (--border, --text, etc.)

### Issue D: onClick Handler Not Firing
The button HTML might not be rendering properly.

**Check in DevTools Console:**
```javascript
// Check if the button exists
const btn = document.querySelector('button[onclick="showAgencySearchModal()"]');
console.log('Button found:', !!btn);

// Try clicking it manually
if (btn) btn.click();
// Modal should appear
```

**Fix:** Rebuild HTML if corrupted

## Quick Diagnostic

Run this in browser DevTools Console (F12 → Console):

```javascript
console.clear();
console.log('=== AGENCY SEARCH DIAGNOSTICS ===');

// 1. Check button
const btn = document.querySelector('button[onclick="showAgencySearchModal()"]');
console.log('✓ Button exists:', !!btn);

// 2. Check function
console.log('✓ showAgencySearchModal exists:', typeof showAgencySearchModal === 'function');

// 3. Check modal
const modal = document.getElementById('agency-search-modal');
console.log('✓ Modal exists:', !!modal);
console.log('  Modal display:', modal ? modal.style.display : 'N/A');

// 4. Check auth
const token = localStorage.getItem('rs_token');
console.log('✓ Token exists:', !!token);
console.log('  Token preview:', token ? token.substring(0, 30) + '...' : 'MISSING');

// 5. Try clicking button manually
console.log('\n→ Attempting to show modal...');
try {
  showAgencySearchModal();
  console.log('✓ Modal shown successfully');
} catch(e) {
  console.error('✗ Error:', e.message);
}

console.log('\nIf modal didn\'t appear, check above for errors ↑');
```

## Expected Output

If everything works:
```
=== AGENCY SEARCH DIAGNOSTICS ===
✓ Button exists: true
✓ showAgencySearchModal exists: true
✓ Modal exists: true
  Modal display: none
✓ Token exists: true
  Token preview: eyJ0eXAi...

→ Attempting to show modal...
✓ Modal shown successfully

If modal didn't appear, check above for errors ↑
```

## What to Look For

- ✅ All checks return `true`
- ✅ Token preview shows `eyJ0...`
- ✅ Modal shown successfully
- ✅ Modal appears on screen

## If Something Is Wrong

### If "Button exists: false"
- **Problem:** Button not in DOM
- **Cause:** HTML file corrupted or incomplete
- **Fix:** Restore from git: `git checkout public/index.html`

### If "showAgencySearchModal exists: false"
- **Problem:** Function not loaded
- **Cause:** JavaScript error in file
- **Fix:** Check console for red errors

### If "Modal exists: false"
- **Problem:** Modal HTML not in page
- **Cause:** HTML incomplete
- **Fix:** Check if line 2447 exists in file

### If "Token exists: false"
- **Problem:** Not authenticated
- **Cause:** Not logged in
- **Fix:** Log in first

### If "Modal shown successfully" but nothing appears
- **Problem:** CSS or visibility issue
- **Cause:** Display property overridden
- **Fix:** Check CSS (might need to debug styles)

## Step-by-Step Fix

1. **Open DevTools:** F12
2. **Go to Console:** Click Console tab
3. **Run diagnostic:** Paste the code above
4. **Read output:** Find which check fails
5. **Share result:** Tell me which check fails and what the error is

## Files Involved

- `public/index.html` - Contains HTML, CSS, JavaScript
- `src/routes/agency-search.js` - Backend API
- `server.js` - Route registration
- `.env` - API keys (PERPLEXITY_KEY required)

## Common Fixes

```bash
# If file is corrupted, restore it
git checkout public/index.html

# If git doesn't help, pull latest
git pull origin main

# If changes broke it, check diff
git diff HEAD~ public/index.html

# Restart server
npm start
```

## Next Steps

1. Run the diagnostic code above
2. Tell me what output you see
3. Tell me if modal appears or not
4. Share any red errors from console

With that info, I can pinpoint the exact issue! 🎯
