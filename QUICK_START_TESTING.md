# Agency Search - Quick Start Testing Guide

## 🚀 Start Testing Right Now

The Agency Search feature is fully implemented and ready to test. Follow these steps to see it in action.

---

## Prerequisites

You need:
- Node.js installed
- A web browser
- The Respawn Signal project

---

## Step 1: Start the Server

Open terminal and run:

```bash
cd C:\Users\AjayI\.openclaw\workspace\respawn-signal\public
python -m http.server 8000
```

Or if using Node:
```bash
npx http-server -p 8000
```

You should see: `Serving HTTP on http://127.0.0.1:8000`

---

## Step 2: Open the App

Go to: **http://localhost:8000**

(If localhost doesn't work, try: http://127.0.0.1:8000)

---

## Step 3: Navigate to Agency Search

1. Look at the sidebar on the left
2. Find "Agency Search" (between "All Deals" and "Automation")
3. Click it

You should see:
- Page title: "Agency Search"
- Description: "Manage agencies and bulk scan their creator rosters."
- "[+ Add Agency]" button
- Empty states for agencies and creators

---

## Step 4: Add Your First Agency

1. Click **[+ Add Agency]** button

### Step 1: Agency Details
You'll see a modal with:
- **Agency URL or Domain** field
- **Agency Name** field (optional)

Enter:
- URL: `fashionworks.com`
- Name: `Fashion Works Agency`

Click **[Find Creators]**

### Step 2: Creator Selection
Now you see:
- "Discovered Creators" header
- "Select All" checkbox
- List of 5 creators with:
  - Name (@handle)
  - Platform (TIKTOK, INSTAGRAM, etc.)
  - Follower count (2.5M, 950K, etc.)

**Test things:**
1. Click "Select All" → All checkboxes check ✓
2. Uncheck "Select All" → All uncheck ✓
3. Click individual checkboxes → Select some creators
4. Back button is visible now

Click **[Continue]**

### Step 3: Confirmation
You see:
- **Summary box** showing:
  - Agency name: "Fashion Works Agency"
  - Domain: fashionworks.com
  - Creator count: "X creators selected"
- Blue info box: "Ready to save..."

Click **[Save & Scan Now]**

---

## Step 5: View Your Agency

After clicking "Save & Scan Now", you return to the main Agency Search page.

### You should see:

#### Agency Cards Section
A card showing:
- **Title:** "Fashion Works Agency"
- **Domain:** "fashionworks.com"
- **Stats:** "5 creators    Last scan: Mar 25, 10:30 AM"
- **Buttons:** [Scan] and [Delete]

#### Creator Table
A table with 5 rows:

| Creator | Platform | Followers | Last Deal | Action |
|---------|----------|-----------|-----------|--------|
| @fashionista_ella | TIKTOK | 2.5M | 2 weeks ago | [Scan] |
| @tech_guru_max | TIKTOK | 1.8M | 1 week ago | [Scan] |
| @beauty_by_sophie | INSTAGRAM | 950K | 3 days ago | [Scan] |
| @lifestyle_vibe | YOUTUBE | 650K | 4 days ago | [Scan] |
| @gaming_pro_leo | TWITCH | 420K | 5 days ago | [Scan] |

---

## Step 6: Test Filtering

At the top of the Creator Table, find the filter dropdowns:
- **"All Agencies ▼"**
- **"All Platforms ▼"**

### Test Filter by Agency
1. Click "All Agencies ▼"
2. Select "Fashion Works Agency"
3. Table should still show all 5 creators (they're all in this agency)

### Test Filter by Platform
1. Click "All Platforms ▼"
2. Select "TIKTOK"
3. Table should show only 2 creators: @fashionista_ella and @tech_guru_max
4. Try other platforms (INSTAGRAM, YOUTUBE, TWITCH)
5. Select "All Platforms ▼" again to reset

---

## Step 7: Test Creator Actions

### Individual Creator Scan
1. Click [Scan] button on any creator row
2. You should navigate to the **Scanner** page
3. The creator's handle should be pre-filled in the input field
4. This proves the integration is working! ✓

### Agency Scan
1. Go back to Agency Search
2. Click [Scan] on the agency card
3. You should see an alert: "Scanning 5 creators from Fashion Works Agency..."
4. (Backend integration would batch scan all creators)

---

## Step 8: Test Persistence

This is the coolest part! 📝

1. **Refresh the page** (Ctrl+R or Cmd+R)
2. Navigate back to Agency Search (if not already there)

**Your agency and all creators should still be there!** ✓

This proves the data is being saved to browser localStorage and loads on page refresh.

---

## Step 9: Add Another Agency (Optional)

Try adding a second agency:

1. Click **[+ Add Agency]** again
2. Enter:
   - URL: `techinfluencers.co`
   - Name: `Tech Influencers Pro`
3. Select some creators (try selecting just 2-3)
4. Continue to confirmation
5. Save

Now you should see:
- **2 agency cards** at top
- **Creator filter** shows both agencies
- **Table shows all creators** from both agencies
- Can filter by each agency independently

---

## Step 10: Test Delete

1. Click **[Delete]** on one of the agencies
2. Confirm when asked
3. Agency card disappears
4. Creators from that agency disappear from table
5. Refresh page → deletion persists

---

## 🎯 What You've Just Tested

✅ **Navigation**
- Sidebar links to Agency Search
- Page switches correctly
- Top bar updates

✅ **Modal (3-Step Flow)**
- Step 1: Input validation
- Step 2: Creator selection with checkboxes
- Step 3: Confirmation summary
- Back/Continue buttons work

✅ **Data Display**
- Agency cards show correct information
- Creator table displays properly formatted data
- Follower counts shown correctly (2.5M not 2500000)

✅ **Filtering**
- Filter by agency works
- Filter by platform works
- Filters work together

✅ **Interactions**
- Individual creator scan button works
- Agency scan button triggers
- Delete with confirmation works

✅ **Persistence**
- Data saves to localStorage
- Data persists after page refresh
- Multiple agencies can be stored

✅ **UI/UX**
- Styling matches the rest of the app
- Colors and fonts are consistent
- Layout is clean and professional
- Empty states are helpful

---

## 🐛 Common Issues & Troubleshooting

### Modal doesn't open
- Make sure you're clicking [+ Add Agency] button
- Check browser console (F12) for JavaScript errors
- Try refreshing the page

### Creators don't show in Step 2
- This is normal - they load from mock data
- You should see all 5 creators
- Try refreshing if it seems stuck

### Data doesn't persist after refresh
- Make sure localStorage is enabled in browser
- Check if you're in private/incognito mode (localStorage disabled)
- Open DevTools (F12) → Application → Local Storage
- You should see "rs_agencies" key with JSON data

### Table doesn't update when filters change
- Refresh the page
- Try deleting and re-adding an agency
- Check browser console for errors

### Creator scan button doesn't work
- Make sure you're clicking the [Scan] button in the action column
- You should navigate to Scanner page
- Creator handle should auto-fill

---

## 📊 What the Mock Data Represents

**5 Test Creators:**

1. **@fashionista_ella** (TikTok)
   - Followers: 2.5M (real influencer tier)
   - Last deal: 2 weeks ago
   - Realistic for fashion niche

2. **@tech_guru_max** (TikTok)
   - Followers: 1.8M (strong influencer)
   - Last deal: 1 week ago
   - Realistic for tech niche

3. **@beauty_by_sophie** (Instagram)
   - Followers: 950K (micro-influencer)
   - Last deal: 3 days ago
   - Realistic for beauty niche

4. **@lifestyle_vibe** (YouTube)
   - Followers: 650K (mid-tier)
   - Last deal: 4 days ago
   - Different platform test

5. **@gaming_pro_leo** (Twitch)
   - Followers: 420K (niche platform)
   - Last deal: 5 days ago
   - Tests Twitch integration

All automatically assigned to "Fashion Forward Collective" when created.

---

## 🔄 Next Steps (When Backend Ready)

When the team builds the backend, these will be wired:

1. **Replace MOCK_CREATORS with API:**
   - `GET /api/agencies/discover?url=example.com`
   - Returns actual creators from agency website

2. **Replace localStorage with Supabase:**
   - `POST /api/agencies` - Create agency
   - `GET /api/agencies` - List agencies
   - `DELETE /api/agencies/:id` - Remove agency

3. **Wire Scan Endpoints:**
   - `POST /api/agencies/:id/scan` - Bulk scan
   - WebSocket for real-time progress
   - Results aggregation

4. **Add Analytics:**
   - Most scanned creators
   - Best performing deals
   - Agency performance metrics

---

## 💡 Pro Tips

- **Multi-agency management:** Add 2+ agencies to test filtering
- **Small selection:** Try selecting just 1 creator in Step 2
- **Bulk selection:** Use "Select All" to test all 5
- **Filter combinations:** Try agency + platform together
- **Data persistence:** Close browser completely, reopen to test persistence

---

## 📝 Feedback Checklist

After testing, consider:

- [ ] Is the 3-step modal flow intuitive?
- [ ] Are creator names and followers displayed clearly?
- [ ] Does filtering feel responsive?
- [ ] Is the navigation smooth and predictable?
- [ ] Would you want more or fewer details in the table?
- [ ] Should there be search as well as filtering?
- [ ] Would bulk actions be more useful?
- [ ] Any UI elements confusing?

---

## 🎉 You're Done!

You've successfully tested the complete Agency Search feature. The UI is fully functional with mock data, ready for:

1. **Backend integration** (Supabase wiring)
2. **Creator discovery** (Real scraping)
3. **Scan integration** (Queue & progress)
4. **User feedback** (Refinements)

**Everything is production-ready for the front-end.** Ready to show users! 🚀
