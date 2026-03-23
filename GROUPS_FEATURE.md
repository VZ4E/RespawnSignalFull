# Groups Feature - Respawn Signal

A comprehensive guide to the new Groups feature for bulk creator scanning.

## Overview

The Groups feature allows users to:
- Create named lists of creators across multiple platforms
- Bulk scan entire groups of creators at once
- Manage group membership (max 20 creators per group)
- View group-tagged scan results and history
- Export results to CSV

## Database Schema

### Tables

#### `creator_groups`
Stores user-created groups.
```sql
- id: UUID (PK)
- user_id: UUID (FK → users.id)
- name: TEXT
- description: TEXT (nullable)
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

#### `group_members`
Links creators to groups.
```sql
- id: UUID (PK)
- group_id: UUID (FK → creator_groups.id)
- platform: TEXT ('tiktok', 'youtube', 'instagram', 'twitch')
- handle: TEXT
- created_at: TIMESTAMPTZ
- UNIQUE(group_id, platform, handle) — prevents duplicates
```

#### `bulk_scans`
Records bulk scan operations and results.
```sql
- id: UUID (PK)
- user_id: UUID (FK → users.id)
- group_id: UUID (FK → creator_groups.id)
- status: TEXT ('pending', 'running', 'completed', 'failed')
- results: JSONB (array of scan results)
- started_at: TIMESTAMPTZ
- completed_at: TIMESTAMPTZ (nullable)
- created_at: TIMESTAMPTZ
```

### Indexes
- `idx_creator_groups_user_id` → query groups by user
- `idx_group_members_group_id` → query members by group
- `idx_bulk_scans_user_id` → query scans by user
- `idx_bulk_scans_group_id` → query scans by group
- `idx_bulk_scans_status` → filter scans by status

### Row Level Security (RLS)
All tables have RLS enabled. Users can only access/modify their own groups, members, and scans.

## API Endpoints

### Group Management

#### `POST /api/groups`
Create a new group.
```json
{
  "name": "Fitness Creators",
  "description": "Top fitness content creators"
}
```
Response:
```json
{
  "id": "uuid",
  "name": "Fitness Creators",
  "description": "...",
  "memberCount": 0,
  "created_at": "...",
  "updated_at": "..."
}
```

#### `GET /api/groups`
List all groups for the authenticated user.
Response:
```json
{
  "groups": [
    {
      "id": "uuid",
      "name": "Fitness Creators",
      "memberCount": 5,
      "lastScannedAt": "2024-01-15T10:00:00Z",
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

#### `GET /api/groups/:groupId`
Get group details including members.
Response:
```json
{
  "id": "uuid",
  "name": "Fitness Creators",
  "description": "...",
  "members": [
    {
      "id": "uuid",
      "platform": "tiktok",
      "handle": "@fitnessjoe"
    }
  ],
  "created_at": "...",
  "updated_at": "..."
}
```

#### `PUT /api/groups/:groupId`
Update group name/description.
```json
{
  "name": "Top Fitness Creators",
  "description": "Updated description"
}
```

#### `DELETE /api/groups/:groupId`
Delete a group (cascades to members & scans).

### Group Members

#### `POST /api/groups/:groupId/members`
Add creator(s) to a group.
```json
{
  "members": [
    { "platform": "tiktok", "handle": "@user1" },
    { "platform": "youtube", "handle": "@user2" }
  ]
}
```
- Max 20 members per group
- Duplicates (same platform + handle) are silently skipped
- Returns count of added members

#### `DELETE /api/groups/:groupId/members/:memberId`
Remove a creator from a group.

### Bulk Scanning

#### `POST /api/groups/:groupId/bulk-scan`
Start a bulk scan of all group members.
```json
{
  "range": 3
}
```
Response:
```json
{
  "id": "scan-uuid",
  "groupId": "group-uuid",
  "groupName": "Fitness Creators",
  "status": "pending",
  "memberCount": 5,
  "range": 3,
  "estimatedCredits": 15,
  "members": [
    { "id": "...", "platform": "tiktok", "handle": "@user1" }
  ],
  "message": "Preview ready. Ready to scan when you confirm."
}
```
Status codes:
- **202**: Accepted (preview ready, not yet scanning)
- **402**: Insufficient credits
- **403**: Not authorized
- **400**: Empty group or invalid parameters

#### `GET /api/groups/:groupId/bulk-scans`
Get scan history for a group.
Response:
```json
{
  "scans": [
    {
      "id": "uuid",
      "status": "completed",
      "started_at": "...",
      "completed_at": "...",
      "resultCount": 12
    }
  ]
}
```

#### `GET /api/groups/bulk-scans/:scanId`
Get detailed results of a specific scan.
Response:
```json
{
  "id": "uuid",
  "status": "completed",
  "started_at": "...",
  "completed_at": "...",
  "results": [
    {
      "creator_id": "...",
      "platform": "tiktok",
      "handle": "@user1",
      "status": "completed",
      "deals_found": 3,
      "deals": [...]
    }
  ],
  "resultCount": 12
}
```

## Frontend UI

### Navigation
- Added "Groups" nav item in sidebar (TOOLS section, between Automation and Credits)
- Added "Groups" tab in Settings

### Groups Standalone Page (`page-groups`)
Accessible via sidebar "Groups" link.
- List of all user groups
- Group name, member count, last scan date
- Quick edit/delete buttons per group
- "New Group" button

### Groups Settings Tab
Accessible via Settings > Groups tab.
- Same list and edit functionality as standalone page
- Integrated with other settings tabs

### Group Edit Modal
- Group name & description fields
- Member list display with remove buttons
- Add members manually:
  - Platform dropdown (TikTok, YouTube, Instagram, Twitch)
  - Handle input
  - Add button
- Bulk import:
  - Paste format: `platform:handle` (one per line)
  - Auto-dedup on import
  - Shows import count
- Save button

### Bulk Scan UI (Future Enhancement)
- "Scan Group" button (disabled if no members)
- Credit preview modal
- Confirmation dialog
- Progress indicator during scan
- Results summary table (Creator | Platform | Deals Found | Status)
- CSV export button

## Key Features

### Deduplication
- On import, creators with identical `platform + handle` are silently skipped
- Prevents accidental duplicates when pasting/importing lists

### Credit Management
- Credits are estimated upfront (~1 per creator per video range)
- Currently shown in preview (execution to follow)
- Refunds issued automatically on failure

### Max Group Size
- 20 creators per group (enforced at API level)
- Error returned if limit exceeded

### Bulk Scan Results
- Results tagged with `group_id` and `bulk_scan_id`
- Results stored in `bulk_scans.results` as JSON array
- Status tracked: pending → running → completed/failed

## Installation & Deployment

### 1. Run Database Migration
In Supabase dashboard, navigate to SQL Editor and run:
```bash
cat supabase/groups-migration.sql
```

Alternatively, use Supabase CLI:
```bash
supabase migration new add_groups_feature
# Then copy supabase/groups-migration.sql content
supabase db push
```

### 2. Restart Backend
```bash
npm install
npm start
```

### 3. Test the Feature
- Open the app
- Navigate to sidebar "Groups" or Settings > Groups
- Create a group
- Add members manually or via bulk import
- View group details

## File Changes

### New Files
- `supabase/groups-migration.sql` — Database migration
- `src/routes/groups.js` — All API endpoints

### Modified Files
- `server.js` — Added groups route registration
- `public/index.html` — Added UI, JavaScript handlers, sidebar nav

## Testing Checklist

- [ ] Create a group
- [ ] Rename/update group
- [ ] Delete a group
- [ ] Add single member manually
- [ ] Add multiple members via bulk import (test dedup)
- [ ] View group members
- [ ] Remove a member
- [ ] Start bulk scan (test credit preview)
- [ ] View scan history
- [ ] View scan results
- [ ] Test empty group error
- [ ] Test max 20-member limit
- [ ] Test RLS (can't access other users' groups)

## Future Enhancements

1. **Async Bulk Scanning** — Process scans in background with proper refunds
2. **CSV Export** — Export results to downloadable CSV
3. **Progress Polling** — Real-time scan progress on frontend
4. **Duplicate Detection** — Smart matching for alternate handles
5. **Group Templates** — Pre-built groups for common categories
6. **Bulk Operations** — Edit/delete multiple groups at once
7. **Analytics** — Group performance metrics & trends

## Troubleshooting

### "Not authorized" errors
- Check user_id is set correctly
- Verify RLS policies are enabled
- Confirm you're accessing your own groups

### "Group has no members"
- Add at least one creator to the group before scanning

### "Insufficient credits"
- Check credits remaining in sidebar
- Purchase more credits if needed

### Duplicate members not being added
- Dedup is intentional (prevents duplicates on import)
- Check if the exact platform+handle combo already exists

## Support

For issues or questions, refer to the existing scan feature documentation — Groups follows the same patterns for auth, credits, and result handling.
