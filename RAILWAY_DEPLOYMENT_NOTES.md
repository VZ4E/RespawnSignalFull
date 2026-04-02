# Railway Deployment Notes

## Auto-Deployment Status

✅ **Commit pushed to GitHub:** a727308  
✅ **Legal pages added to RespawnSignal**  
✅ **Railway auto-deployment enabled**

---

## What Gets Deployed

Railway will automatically deploy the following changes to production:

### New Legal Pages
```
public/privacy-policy.html     (14.9 KB)
public/terms-of-service.html   (16.5 KB)
public/refund-policy.html      (14.7 KB)
public/settings.html           (20.2 KB)
```

### Modified Files
```
public/index.html              (Added AI warnings + settings section)
```

### Deployment Trigger
- **Event:** Push to `main` branch
- **Time:** Automatic (typically < 2-5 minutes)
- **Logs:** Available in Railway dashboard under Deployments

---

## URLs After Deployment

Once Railway finishes deploying, these URLs will be live:

| Page | URL |
|------|-----|
| Privacy Policy | `https://respawnmedia.co/privacy-policy` |
| Terms of Service | `https://respawnmedia.co/terms-of-service` |
| Refund Policy | `https://respawnmedia.co/refund-policy` |
| Settings | `https://respawnmedia.co/settings` |

---

## Testing After Deployment

### Step 1: Verify Static Files Load
```bash
# Test privacy policy page
curl -I https://respawnmedia.co/privacy-policy
# Should return 200 OK

# Test terms of service
curl -I https://respawnmedia.co/terms-of-service
# Should return 200 OK
```

### Step 2: Visual Inspection
1. Open each legal page in a browser
2. Verify styling loads correctly (header, footer, content)
3. Check that internal links navigate between pages
4. Verify contact links work (mailto: links)

### Step 3: In-App Links
1. Log into the app
2. Navigate to Account → Settings → Account tab
3. Click on legal document links (Privacy, Terms, Refund)
4. Verify they open in new tabs and display correctly

### Step 4: Scan Results Warnings
1. Run a TikTok scan
2. Verify AI accuracy warning appears above results
3. Verify platform compliance notice appears above results
4. Repeat for YouTube/manual scan

---

## Rollback Plan

If there are issues with the deployment:

```bash
# Identify the previous commit
git log --oneline

# Find commit before a727308 (should be 1b52426)
# Revert if needed
git revert a727308
git push origin main

# Railway will auto-deploy the revert
```

---

## Monitoring

### Railway Dashboard Checks
1. **Deployments tab** - View deployment status and logs
2. **Logs tab** - Monitor for any errors
3. **Network** - Check if 4xx/5xx errors appear for legal pages

### Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| 404 Not Found on legal pages | Static files not deployed | Check Railway build logs, verify public/ folder synced |
| Styling broken | CSS not loading | Verify relative paths in HTML (should be `/privacy-policy`, not `privacy-policy`) |
| Links not working | Typo in href | Check HTML for broken link references |
| App breaks | JavaScript error in index.html | Check browser console, verify syntax in added functions |

---

## Post-Deployment Checklist

- [ ] Privacy policy page loads and displays correctly
- [ ] Terms of service page loads and displays correctly
- [ ] Refund policy page loads and displays correctly
- [ ] Settings page loads and displays correctly
- [ ] AI accuracy warnings appear on scan results
- [ ] Platform compliance notices appear on scan results
- [ ] Legal links in account settings work
- [ ] Mobile responsive design works on all legal pages
- [ ] Footer displays correctly on all pages
- [ ] Contact email links work (legal@respawnmedia.co, support@respawnmedia.co)
- [ ] No console errors in browser

---

## Communication Plan

Once deployment is verified working:

1. **Email to legal@respawnmedia.co** - Notify legal team of live legal pages
2. **Update support documentation** - Point users to /privacy-policy, /terms-of-service, /refund-policy, /settings
3. **Marketing update** - Include legal page links in website footer if external site exists
4. **Onboarding update** - Include terms acceptance checkpoint in signup flow (future enhancement)

---

## Future Enhancement: Terms Acceptance

The current implementation shows legal pages, but doesn't enforce acceptance during signup.

### Recommended Next Step
Add a modal or checkbox during signup that requires users to accept Terms of Service:

```javascript
// In signup flow
const termsAccepted = document.getElementById('accept-terms').checked;
if (!termsAccepted) {
  showError('You must accept the Terms of Service to create an account');
  return;
}
```

This ensures legal compliance by documenting user acceptance.

---

**Deployment Status:** ✅ Complete and ready for Railway auto-deployment  
**Last Updated:** March 26, 2026  
**Deployed by:** RespawnSignal Development Team
