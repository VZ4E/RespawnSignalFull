# Agency Search UI Visual Guide

## Main Agency Search Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SIDEBAR          │  Agency Search                                       │
│ ────────────────  │  ─────────────────────────────────────────────────  │
│                   │  Manage agencies and bulk scan their creator rosters.│
│ • Scanner         │                                                       │
│ • Scan History    │  [+ Add Agency]                                       │
│ • All Deals       │                                                       │
│ • Agency Search   │  ┌──────────────────────────────────────────────────┐│
│ • Automation      │  │ Agencies                                         ││
│ • Groups          │  │                                                  ││
│                   │  │ ┌────────────────────────────────────────────┐  ││
│                   │  │ │ Fashion Forward Collective                 │  ││
│                   │  │ │ fashionworks.com                           │  ││
│                   │  │ │ 5 creators    Last scan: Mar 25, 10:30 AM  │  ││
│                   │  │ │                          [Scan] [Delete]    │  ││
│                   │  │ └────────────────────────────────────────────┘  ││
│                   │  └──────────────────────────────────────────────────┘│
│                   │                                                       │
│                   │  ┌──────────────────────────────────────────────────┐│
│                   │  │ Creators                      [Filters: All  All] ││
│                   │  ├────────────────────────────────────────────────────┤
│                   │  │ Handle        │ Platform │ Followers │ Last Deal │  │
│                   │  │               │          │           │           │  │
│                   │  │ @fashionista_ │ TIKTOK   │ 2.5M      │ 2 weeks   │  │
│                   │  │ ella           │          │           │ ago       │  │
│                   │  │ In: Fashion... │          │           │      [Scan] │
│                   │  │ ───────────────┼──────────┼───────────┼───────────┤  │
│                   │  │ @tech_guru_max │ TIKTOK   │ 1.8M      │ 1 week    │  │
│                   │  │ In: Fashion... │          │           │ ago       │  │
│                   │  │                │          │           │      [Scan] │
│                   │  │ ...more rows...│          │           │           │  │
│                   │  └────────────────────────────────────────────────────┘│
│                   │                                                       │
│                   │  ┌──────────────────────────────────────────────────┐│
│                   │  │ [Bulk Scan Selected Creators]                    ││
│                   │  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Add Agency Modal - Step 1: Agency Details

```
┌────────────────────────────────────────────┐
│ Add New Agency                         [✕]  │
├────────────────────────────────────────────┤
│                                            │
│ Agency URL or Domain                       │
│ ┌──────────────────────────────────────┐   │
│ │ e.g., creativeworks.com or @creator  │   │
│ └──────────────────────────────────────┘   │
│ Enter the agency's website or social...    │
│                                            │
│ Agency Name (optional)                     │
│ ┌──────────────────────────────────────┐   │
│ │ e.g., Creative Works Agency          │   │
│ └──────────────────────────────────────┘   │
│                                            │
├────────────────────────────────────────────┤
│                  [Cancel]  [Find Creators] │
└────────────────────────────────────────────┘
```

---

## Add Agency Modal - Step 2: Creator Selection

```
┌────────────────────────────────────────────┐
│ Add New Agency                         [✕]  │
├────────────────────────────────────────────┤
│                                            │
│ Discovered Creators        [☑ Select All]  │
│ ┌──────────────────────────────────────┐   │
│ │ ☐ @fashionista_ella                  │   │
│ │   TIKTOK • 2.5M followers             │   │
│ │ ─────────────────────────────────────│   │
│ │ ☑ @tech_guru_max                     │   │
│ │   TIKTOK • 1.8M followers             │   │
│ │ ─────────────────────────────────────│   │
│ │ ☑ @beauty_by_sophie                  │   │
│ │   INSTAGRAM • 950K followers          │   │
│ │ ─────────────────────────────────────│   │
│ │ ☑ @lifestyle_vibe                    │   │
│ │   YOUTUBE • 650K followers            │   │
│ │ ─────────────────────────────────────│   │
│ │ ☐ @gaming_pro_leo                    │   │
│ │   TWITCH • 420K followers             │   │
│ └──────────────────────────────────────┘   │
│                                            │
├────────────────────────────────────────────┤
│                   [Back]  [Cancel]  [Cont] │
└────────────────────────────────────────────┘
```

---

## Add Agency Modal - Step 3: Confirmation

```
┌────────────────────────────────────────────┐
│ Add New Agency                         [✕]  │
├────────────────────────────────────────────┤
│                                            │
│ ┌──────────────────────────────────────┐   │
│ │ Summary                              │   │
│ │                                      │   │
│ │ Fashion Works Agency                 │   │
│ │ Domain: fashionworks.com             │   │
│ │ 4 creators selected                  │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ ┌──────────────────────────────────────┐   │
│ │ Ready to save. You can scan          │   │
│ │ creators immediately after.          │   │
│ └──────────────────────────────────────┘   │
│                                            │
├────────────────────────────────────────────┤
│                   [Back]  [Cancel]         │
│                           [Save & Scan Now]│
└────────────────────────────────────────────┘
```

---

## Creator Table - Filtering

```
Creators                     [All Agencies ▼] [All Platforms ▼]

┌─────────────────────────────────────────────────────────────┐
│ Creator         │ Platform   │ Followers  │ Last Deal   │    │
├─────────────────────────────────────────────────────────────┤
│ @fashionista_   │ TIKTOK     │ 2.5M       │ 2 weeks ago │    │
│ ella            │            │            │             │Scan│
│ In: Fashion ... │            │            │             │    │
├─────────────────────────────────────────────────────────────┤
│ @tech_guru_max  │ TIKTOK     │ 1.8M       │ 1 week ago  │    │
│ In: Fashion ... │            │            │             │Scan│
├─────────────────────────────────────────────────────────────┤
│ @beauty_by_     │ INSTAGRAM  │ 950K       │ 3 days ago  │    │
│ sophie          │            │            │             │Scan│
│ In: Fashion ... │            │            │             │    │
└─────────────────────────────────────────────────────────────┘

Filtering:
- "All Agencies ▼" dropdown shows: All Agencies, Fashion Forward...
- "All Platforms ▼" dropdown shows: All Platforms, TikTok, YouTube, Instagram, Twitch
- Table updates in real-time as filters change
```

---

## Color Scheme (from globals.css)

```
Primary Accent:  #5AA0E8 (Blue)
Text Primary:    #0f172a (Dark)
Text Secondary:  #475569 (Gray)
Text Tertiary:   #94a3b8 (Light Gray)
Background:      #f8fafc (Very Light)
Surface:         #ffffff (White)
Border:          #e2e8f0 (Light Border)
Success:         #059669 (Green)
```

---

## Interaction Flows

### Adding an Agency

1. Click "+ Add Agency"
   ↓
2. Enter domain/URL + optional name
3. Click "Find Creators"
   ↓
4. See list of 5 mock creators
5. Select creators (or "Select All")
6. Click "Continue"
   ↓
7. Review summary
8. Click "Save & Scan Now"
   ↓
9. Agency appears in cards section
10. Creators appear in table below
11. Can filter by agency or platform

### Scanning a Creator

**Option 1: From table**
- Click individual "Scan" button on any creator
- Navigates to Scanner page with creator pre-filled

**Option 2: Bulk scan**
- Click "Bulk Scan Selected Creators"
- Would trigger batch scan job (backend integration needed)

### Managing Agencies

**Agency Actions:**
- Click "Scan" → Scan all creators in that agency
- Click "Delete" → Remove agency (confirmation required)

**Creator Actions:**
- Click "Scan" → Individual scan
- Use filters to narrow down

---

## CSS Classes Used

```
.card              - Agency card container
.run-btn           - "Add Agency" button (accent blue)
.btn-ghost         - Secondary buttons (outlined)
.form-input        - Input fields
.nav-item.active   - Active sidebar item
.page              - Page container
.empty-state       - Empty state message
.modal             - Modal backdrop
.modal-content     - Modal container
.modal-header      - Modal title bar
.modal-body        - Modal content
.modal-footer      - Modal action buttons
```

---

## Responsive Behavior

- **Desktop (1200px+)**: Full layout, 2-column agency cards
- **Tablet (768px-1200px)**: Stacked layout, single-column agency cards
- **Mobile (<768px)**: All elements stack, scrollable table with horizontal scroll

---

## Empty States

### No agencies yet:
```
Agencies
[empty state box]
"No agencies added yet"
```

### No creators (filters too strict):
```
Creators table
"No creators match filters"
```

### First time user:
```
All components show empty states
"Add your first agency to get started"
```

---

## Data Validation

1. **Agency URL/Domain**: Required
   - Shows error if blank: "Please enter an agency URL or domain"
   
2. **Creator Selection**: Required
   - Shows error if none selected: "Please select at least one creator"
   
3. **Save Confirmation**: Confirms before delete
   - "Delete this agency? You can always add it back later."

---

## Integration Points Ready

✓ Form inputs bound to state
✓ Checkbox state tracking
✓ localStorage persistence
✓ Navigation routing
✓ Filter logic implemented
✓ Action handlers attached

**Ready to wire to Supabase:**
- Replace MOCK_CREATORS with API call
- Replace localStorage with database
- Add real agency scraping logic
- Wire scan endpoints
