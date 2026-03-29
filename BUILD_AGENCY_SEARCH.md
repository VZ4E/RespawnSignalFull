# Build Agency Search — Feature Implementation Prompt

## Overview
Build the Agency Search feature for Respawn Signal. This is a new first-class tab in the dashboard sidebar.

---

## Step 1 — Create the route and tab

- Add `/agency-search` as a new page route in the Next.js App Router
- Add "Agency Search" to the dashboard sidebar nav between Creator Radar and Analytics

---

## Step 2 — Build the "+ Add Agency" popup modal

Three-step modal component:

### Step 1: Input
- Text input for agency URL or creator handle
- "Find Creators" button
- Loading state feedback

### Step 2: Review
- Scrollable list of discovered creators with checkboxes
- Each row shows: creator name, handle, platform icons, follower count
- "Select All" toggle for bulk approval
- Warning badges for unverified accounts

### Step 3: Confirmation
- Summary: "X creators selected from [Agency Name]"
- Two action buttons:
  - "Save & Scan Now" (triggers immediate scan)
  - "Save for Later" (adds to tracked list without scanning)

**For now, mock the scrape response with 5 fake creators so the UI is testable. Don't call real APIs yet.**

---

## Step 3 — Main tab view

After setup, the Agency Search tab shows:

### Agency Cards (Top)
- One card per saved agency
- Shows: agency name, domain, total creators found, how many are currently tracked, when the last scan ran

### Creator Table (Below)
Columns:
- Creator handle/name
- Platform(s) (icons)
- Follower count
- Last detected brand deal
- Individual Scan button

**Bulk Scan button** — pinned at the bottom of the table. One click queues a scan across every tracked creator in the tab.

**Filter controls:**
- Filter by agency
- Filter by platform
- (Optional: follower range, last scan date)

---

## Step 4 — Supabase tables (After UI is done)

Create these tables when ready:

### `agencies` table
```
id (uuid, pk)
user_id (uuid, fk to auth.users)
name (text)
domain (text)
created_at (timestamp)
updated_at (timestamp)
```

### `agency_creators` table
```
id (uuid, pk)
agency_id (uuid, fk to agencies)
creator_handle (text)
platforms (jsonb) — e.g., ["tiktok", "youtube"]
follower_count (int)
tracked (bool, default false)
created_at (timestamp)
updated_at (timestamp)
```

Wire the approval step to insert approved creators into `agency_creators` table.

---

## Step 5 — Wire individual Scan button (After UI is done)

When a user clicks Scan on a creator row, trigger the existing scan pipeline for that creator handle.
Use the same logic already in place for the main Scanner tab.

---

## Priority Order

**Do steps 1–3 first and show the UI before touching Supabase or the scan pipeline.**

1. Create `/agency-search` route
2. Add sidebar nav item
3. Build the 3-step modal component (with mock data)
4. Build agency cards and creator table
5. Style and polish UI
6. _Then_ Supabase schema + data wiring
7. _Then_ scan pipeline integration

---

**Status:** Ready to build
**Target:** UI-first, mock data, iterate before backend integration
