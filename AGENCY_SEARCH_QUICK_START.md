# Agency Search — Quick Start (5 Minutes)

## Files
- `public/js/agency-search-data.js` — Data layer
- `public/js/agency-search-ui.js` — UI layer
- `public/css/agency-search.css` — Styling
- `AGENCY_SEARCH_INTEGRATION.md` — Full docs

## 1. Add to Your HTML

```html
<!-- In <head> -->
<link rel="stylesheet" href="/css/agency-search.css">

<!-- In <body>, after Supabase -->
<script src="/js/agency-search-data.js"></script>
<script src="/js/agency-search-ui.js"></script>

<!-- Initialize -->
<script>
  const ui = new AgencySearchUI('agency-search-container', {
    userId: 'user-123',  // Your user ID
    supabaseUrl: 'https://...',  // Your Supabase URL
    supabaseAnonKey: 'eyJ...',   // Your anon key
  });
</script>
```

## 2. Add Container

```html
<div id="agency-search-container"></div>
```

## 3. Create Database Tables

Copy-paste from `AGENCY_SEARCH_INTEGRATION.md` → SQL → Supabase dashboard.

That's it! Component auto-renders and works.

---

## Listen for Events

```javascript
// When agency is saved
window.addEventListener('agencySearch:saveComplete', (e) => {
  const { agency, creators } = e.detail;
  console.log(`Saved ${creators.length} creators`);
});

// When added to watchlist
window.addEventListener('agencySearch:watchlistAdd', (e) => {
  const { creators } = e.detail;
  console.log(`Added ${creators.length} to watchlist`);
});

// When group scan created
window.addEventListener('agencySearch:groupScanAdd', (e) => {
  const { creators, groupId, groupName } = e.detail;
  console.log(`Created group "${groupName}"`);
});
```

---

## Config Options

```javascript
new AgencySearchUI('container-id', {
  // Required
  userId: 'user-id',

  // Optional (defaults to window globals)
  supabaseUrl: 'https://...',
  supabaseAnonKey: 'eyJ...',
  perplexityKey: 'pplx-...',  // For web scraping (optional)
});
```

---

## Features

✅ Niche classification (12 categories)  
✅ Web scraping (Perplexity AI)  
✅ Manual handle import  
✅ Creator filtering (niche + platform)  
✅ Watchlist management  
✅ Group scan creation  
✅ Fully responsive  
✅ No dependencies  

---

## Troubleshooting

**"Container not found"** → Make sure div exists before script

**"Missing Supabase keys"** → Pass in config or set:
```javascript
window.SUPABASE_URL = 'https://...';
window.SUPABASE_ANON_KEY = 'eyJ...';
```

**"No Perplexity key"** → Component auto-falls back to mock data (good for testing)

**More help?** See `AGENCY_SEARCH_INTEGRATION.md` or check code comments.

---

## Example: Full Page

See `public/agency-search.html` for a complete working example.

---

**Ready?** Copy the 3 files to your project and you're done. 🚀

