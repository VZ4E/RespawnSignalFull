# Agency Search — Feature Outline

## What it is
A creator discovery and verification engine built into Respawn Signal. Users can find every creator tied to an agency by dropping in a URL, or reverse it — start from a single creator and uncover their whole agency roster. From there, they pick who to track and trigger scans individually or in bulk.

---

## Where it lives
Agency Search is its own dedicated tab in the Respawn Signal dashboard sidebar, sitting alongside Scanner, Creator Profiles, Creator Radar, Analytics, and Alerts. It's not a sub-feature — it's a first-class tab with its own view, its own data, and its own connection to the alert system.

---

## The Two Entry Modes

### Mode 1 — Agency URL → Creators
The user pastes an agency's website URL. The system scrapes the agency's talent/roster page, uses AI-assisted extraction to pull creator names and handles, cross-references those against TikTok, YouTube, Instagram, and Twitch to confirm real accounts, and returns a verified list of creators tied to that agency.

### Mode 2 — Creator → Agency Roster
The user pastes a single creator's profile URL or handle. The system identifies what agency they're signed to (from bio links, management tags, or known agency databases), then runs Mode 1 on that agency automatically — returning the full roster of creators under the same roof.

Both modes land on the same approval screen.

---

## The Setup Popup (3 Steps)

When the user clicks "+ Add Agency" from the tab, a popup modal launches with three steps:

### Step 1 — Link the agency
A clean input field. User pastes either an agency website URL or a creator handle. The system detects which mode to use automatically. A "Find creators" button triggers the scrape.

### Step 2 — Review and approve
The popup expands to show the discovered creator list. Each row shows: creator name, handle, platform icons, follower count, and a checkbox. User selects which creators to track. There's a "Select all" toggle for bulk approval. Unverified or unmatched accounts are flagged with a warning so the user can skip or manually confirm them.

### Step 3 — Confirm and scan
User sees a summary: "X creators selected from [Agency Name]." Two options: "Save and scan now" (triggers immediate scan on all approved creators) or "Save for later" (adds them to the tracked list without scanning yet). Once confirmed, the agency is saved as a card on the main Agency Search tab.

---

## The Main Tab View

After setup, the Agency Search tab shows:

**Agency cards at the top** — one card per saved agency. Each card shows the agency name, domain, total creators found, how many are currently tracked, and when the last scan ran.

**Creator table below** — lists every tracked creator across all saved agencies. Columns: creator name/handle, platform(s), follower count, last detected brand deal, tracking status. Each row has an individual Scan button.

**Bulk Scan button** — a persistent action bar at the bottom of the table. One click queues a scan across every tracked creator in the tab. Scan jobs run in the background and update the table when complete.

**Filter controls** — filter the creator table by agency, platform, follower range, or last scan date.

---

## Alert Integration

Agency Search connects directly to the existing Alerts system. When a tracked creator from an agency scan gets a new brand deal detected, it fires through the same alert pipeline as any other scan — email, in-app notification, or Creator Radar digest depending on user settings.

Adding a creator through Agency Search automatically subscribes them to alerts. The user doesn't have to go to Alerts and manually set it up — approval = tracking = alerting, all in one action.

If a user has Creator Radar watchlists set up, approved agency creators can be added to a watchlist in the same confirmation step.

---

## Data Flow Summary

```
Agency URL or Creator handle
 ↓
Scrape / AI extraction (agency roster page)
 ↓
Platform verification (TikTok, YouTube, IG, Twitch)
 ↓
User approval UI (select which creators to track)
 ↓
Saved to agency card on Agency Search tab
 ↓
Scan pipeline triggered (individual or bulk)
 ↓
Brand deal results stored on creator profile
 ↓
Alert fired → Alerts tab + Creator Radar
```

---

## Key Differentiators vs. Regular Scanner

| Regular Scanner | Agency Search |
|---|---|
| One creator at a time | Entire agency roster at once |
| User manually finds handles | System discovers creators automatically |
| No agency context | Groups creators by agency |
| No roster discovery | Bidirectional — URL or creator → roster |
| Alerts set up separately | Alerts auto-enabled on approval |

---

## What to Build First (Recommended Order)

1. The popup UI — URL input, creator list review, confirm step
2. Agency scrape + AI extraction logic (Perplexity `sonar` or Claude API against the roster page HTML)
3. Platform handle verification layer (cross-check against RapidAPI scrapers you already have)
4. Agency card view + creator table on the tab
5. Individual scan button wired to existing scan pipeline
6. Bulk scan queue
7. Alert auto-subscription on creator approval

This slots directly into your existing Next.js App Router structure — the tab is a new route (`/agency-search`), the popup is a client component, and the scrape/verify logic is a new API route that feeds into the same Supabase creator table you're already using.

---

**Created:** 2026-03-28
**Status:** Feature outline (ready for implementation planning)
