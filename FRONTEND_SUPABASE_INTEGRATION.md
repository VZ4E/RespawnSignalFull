# 🔌 Frontend Supabase Integration Guide

Quick reference for connecting the Agency Search frontend to Supabase backend.

---

## 🚀 Setup (5 minutes)

### 1. Install Supabase Client

```bash
npm install @supabase/supabase-js
# or
yarn add @supabase/supabase-js
```

### 2. Initialize Client

Add to your main app file (e.g., before `showApp()`):

```javascript
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  'YOUR_SUPABASE_URL',  // Get from Supabase dashboard → Settings → API
  'YOUR_SUPABASE_ANON_KEY'  // Get from same place, use the "anon" key
);

// Verify connection
console.log('Supabase client ready:', supabase);
```

### 3. Get Your Credentials

1. Go to your Supabase project
2. Click **Settings** (gear icon) in bottom left
3. Click **API** tab
4. Copy:
   - **Project URL** → `YOUR_SUPABASE_URL`
   - **anon public** key → `YOUR_SUPABASE_ANON_KEY`

---

## 📦 Core Operations

### Save Agency (Create)

```javascript
async function saveAndScanAgency() {
  const { name, url } = agencySearchState;
  
  const { data, error } = await supabase
    .from('agencies')
    .insert([
      {
        name: name || extractDomainFromUrl(url),
        domain: extractDomainFromUrl(url),
        website_url: url,
      }
    ])
    .select();

  if (error) {
    console.error('Error saving agency:', error);
    showError('Failed to save agency');
    return;
  }

  const agencyId = data[0].id;
  console.log('Agency created:', agencyId);

  // Now add creators to this agency
  await addCreatorsToAgency(agencyId);
}
```

### Add Creators to Agency

```javascript
async function addCreatorsToAgency(agencyId) {
  const creators = Array.from(agencySearchState.selectedCreators).map(handle => ({
    agency_id: agencyId,
    creator_handle: handle,
    platform: 'tiktok',  // From current platform selection
    follower_count: MOCK_CREATORS[handle]?.followers || 0,
    engagement_rate: MOCK_CREATORS[handle]?.engagement || 0,
  }));

  const { error } = await supabase
    .from('agency_creators')
    .insert(creators);

  if (error) {
    console.error('Error adding creators:', error);
    return;
  }

  console.log('Creators added to agency');

  // Reload agencies
  await loadAgencies();
}
```

### Load Agencies

```javascript
async function loadAgencies() {
  const { data, error } = await supabase
    .from('agencies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading agencies:', error);
    return;
  }

  agencySearchState.agencies = data;
  renderAgencyCards();
}
```

### Load Creators for Agency

```javascript
async function loadAgencyCreators(agencyId) {
  const { data, error } = await supabase
    .from('agency_creators')
    .select('*')
    .eq('agency_id', agencyId);

  if (error) {
    console.error('Error loading creators:', error);
    return;
  }

  return data;
}
```

### Delete Agency

```javascript
async function deleteAgency(agencyId) {
  if (!confirm('Delete this agency and all its creators?')) return;

  const { error } = await supabase
    .from('agencies')
    .delete()
    .eq('id', agencyId);

  if (error) {
    console.error('Error deleting agency:', error);
    return;
  }

  console.log('Agency deleted');
  await loadAgencies();
}
```

### Log Scan

```javascript
async function logScan(agencyId, creatorCount) {
  const { error } = await supabase
    .from('agency_scans')
    .insert([
      {
        agency_id: agencyId,
        scan_type: 'creators_only',
        creator_count: creatorCount,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }
    ]);

  if (error) {
    console.error('Error logging scan:', error);
  }

  // Update last_scan_at on agency
  await supabase
    .from('agencies')
    .update({ last_scan_at: new Date().toISOString() })
    .eq('id', agencyId);
}
```

---

## 🔄 Replace Mock Data Flow

### Current (Mock):
```
User fills form → Show mock creators → Save to localStorage
```

### New (With Supabase):
```
User fills form → Fetch real creators from API → Save to Supabase → Reload from DB
```

### Implementation:

1. **Replace MOCK_CREATORS:**

```javascript
// OLD: Use hardcoded mock data
// const creators = MOCK_CREATORS;

// NEW: Fetch from your creator discovery API
async function discoverCreators(agencyUrl) {
  try {
    const response = await fetch('/api/discover-creators', {
      method: 'POST',
      body: JSON.stringify({ url: agencyUrl }),
    });
    const creators = await response.json();
    return creators;
  } catch (e) {
    console.error('Discovery failed, showing mock:', e);
    return MOCK_CREATORS;  // Fallback to mock
  }
}
```

2. **Update modal to use real creators:**

```javascript
async function nextAgencyStep() {
  if (agencySearchState.currentStep === 1) {
    // Step 1 → 2: Discover creators
    const creators = await discoverCreators(agencySearchState.currentAgencyUrl);
    agencySearchState.creators = creators;
    renderCreatorSelection();
  }
  
  if (agencySearchState.currentStep === 2) {
    // Step 2 → 3: Move to confirmation
    showConfirmation();
  }
}
```

---

## 🔐 Authentication

Before any database operations, verify user is logged in:

```javascript
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    console.log('Not authenticated');
    return null;
  }

  return user;
}

// Use before database operations:
const user = await getCurrentUser();
if (!user) {
  showError('Please log in first');
  return;
}
```

---

## 📊 Advanced: Real-time Updates

Listen to agency changes in real-time:

```javascript
// Subscribe to changes
supabase
  .channel('agencies')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'agencies' },
    (payload) => {
      console.log('Agency updated:', payload);
      loadAgencies();  // Reload
    }
  )
  .subscribe();
```

---

## 🎯 Integration Points in Current Code

### In `nextAgencyStep()` - Line ~8500
```javascript
// Replace this:
// MOCK_CREATORS already shown

// With this:
async function nextAgencyStep() {
  if (agencySearchState.currentStep === 1) {
    const creators = await discoverCreators(agencySearchState.currentAgencyUrl);
    agencySearchState.creators = creators;
  }
  // ... rest of logic
}
```

### In `saveAndScanAgency()` - Line ~8600
```javascript
// Replace this:
// localStorage.setItem('rs_agencies', JSON.stringify(...))

// With this:
async function saveAndScanAgency() {
  const agencyId = await saveAgency();
  await addCreatorsToAgency(agencyId);
  await loadAgencies();
}
```

### In `renderAgencyCards()` - Line ~8700
```javascript
// Replace this:
// agencySearchState.agencies.forEach(agency => ...)

// With this:
async function renderAgencyCards() {
  await loadAgencies();  // Fetch fresh from DB
  // ... render existing code
}
```

### In `deleteAgency()` - Line ~8800
```javascript
// Replace this:
// agencySearchState.agencies = agencySearchState.agencies.filter(...)

// With this:
async function deleteAgency(agencyId) {
  await supabase.from('agencies').delete().eq('id', agencyId);
  await loadAgencies();  // Reload
}
```

---

## 🧪 Test Queries

Run these in Supabase **SQL Editor** to verify setup:

### Check agencies exist
```sql
SELECT * FROM agencies LIMIT 5;
```

### Check creators linked
```sql
SELECT a.name, COUNT(ac.id) as creator_count
FROM agencies a
LEFT JOIN agency_creators ac ON a.id = ac.agency_id
GROUP BY a.id, a.name;
```

### Check scans logged
```sql
SELECT a.name, COUNT(s.id) as scan_count
FROM agencies a
LEFT JOIN agency_scans s ON a.id = s.agency_id
GROUP BY a.id, a.name;
```

---

## 🚨 Error Handling

```javascript
async function safeDbOperation(operation) {
  try {
    const result = await operation();
    
    if (result.error) {
      console.error('Database error:', result.error.message);
      
      // User-friendly messages
      if (result.error.code === 'PGRST116') {
        showError('No results found');
      } else if (result.error.code === 'PGRST204') {
        showError('Not found');
      } else {
        showError('Database error: ' + result.error.message);
      }
      
      return null;
    }
    
    return result.data;
  } catch (err) {
    console.error('Unexpected error:', err);
    showError('Something went wrong');
    return null;
  }
}

// Use it:
const agencies = await safeDbOperation(() => 
  supabase.from('agencies').select('*')
);
```

---

## 📋 Integration Checklist

- [ ] Install `@supabase/supabase-js`
- [ ] Add Supabase client initialization
- [ ] Get API URL and anon key from dashboard
- [ ] Replace mock data with `discoverCreators()` API call
- [ ] Update `saveAndScanAgency()` to use `supabase.from('agencies').insert()`
- [ ] Update `loadAgencies()` to fetch from Supabase
- [ ] Update `deleteAgency()` to use Supabase delete
- [ ] Add user authentication check
- [ ] Test all CRUD operations
- [ ] Verify RLS policies with test user
- [ ] Deploy to production

---

## 📚 References

- **Supabase Docs:** https://supabase.com/docs
- **JS Client Reference:** https://supabase.com/docs/reference/javascript
- **RLS Guide:** https://supabase.com/docs/guides/auth/row-level-security
- **Real-time:** https://supabase.com/docs/guides/realtime

---

## 💡 Tips

1. **Always await database calls** - They're async
2. **Check error object** - Every response has `.error`
3. **Use RLS** - It's automatic, but verify in SQL
4. **Keep anon key public** - That's what it's for
5. **Store service_role key safely** - Never expose to browser
6. **Test locally first** - Use mock data in dev
7. **Monitor real-time** - Use Supabase Realtime for live updates

---

## 🎉 Next Steps

1. Run `SUPABASE_SCHEMA.sql` in your Supabase project
2. Implement the integration code above
3. Test each operation individually
4. Deploy with confidence

You're ready to go! 🚀
