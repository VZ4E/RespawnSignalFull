# Agency Search API Routes - Testing Guide

## Setup

1. Get a Supabase auth token for testing:
   ```bash
   # Via Supabase dashboard: Authentication → Users → Create new user
   # Or via API if you have admin access
   ```

2. Set the token in your environment:
   ```bash
   # Windows PowerShell
   $env:TEST_AUTH_TOKEN = "Bearer <your-token>"
   
   # Or add to .env file
   TEST_AUTH_TOKEN=Bearer <your-token>
   ```

## API Routes

### 1. POST /api/agency-search/save
**Save an agency and its creators to Supabase**

```bash
curl -X POST http://localhost:3000/api/agency-search/save \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "agencyName": "Test Digital Agency",
    "agencyDomain": "testagency.com",
    "creators": [
      { "handle": "creator_one", "platforms": ["tiktok"], "followerCount": 150000 },
      { "handle": "creator_two", "platforms": ["youtube"], "followerCount": 500000 }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "agencyId": "uuid-here",
  "agencyName": "Test Digital Agency",
  "agencyDomain": "testagency.com",
  "creatorCount": 2,
  "creators": [
    {
      "id": "uuid",
      "handle": "creator_one",
      "platform": "tiktok",
      "followerCount": 150000
    }
  ]
}
```

### 2. GET /api/agency-search/list
**List all agencies and their creators for the authenticated user**

```bash
curl -X GET http://localhost:3000/api/agency-search/list \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 1,
  "agencies": [
    {
      "id": "uuid",
      "name": "Test Digital Agency",
      "domain": "testagency.com",
      "website_url": null,
      "industry": null,
      "creatorCount": 2,
      "creators": [
        {
          "id": "uuid",
          "handle": "creator_one",
          "platform": "tiktok",
          "followerCount": 150000,
          "engagementRate": null,
          "status": "active",
          "createdAt": "2026-03-29T00:45:00Z"
        }
      ],
      "createdAt": "2026-03-29T00:45:00Z",
      "updatedAt": "2026-03-29T00:45:00Z",
      "lastScanAt": null
    }
  ]
}
```

### 3. DELETE /api/agency-search/:agencyId
**Delete an agency and all its associated creators**

```bash
curl -X DELETE http://localhost:3000/api/agency-search/{agencyId} \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Replace `{agencyId}` with the actual agency ID from the list response.

**Expected Response:**
```json
{
  "success": true,
  "message": "Agency deleted successfully"
}
```

## Test Sequence

1. **Save a test agency:**
   ```bash
   POST /save → Save agency, get agencyId
   ```

2. **List agencies:**
   ```bash
   GET /list → Verify agency appears with creators
   ```

3. **Delete the agency:**
   ```bash
   DELETE /:agencyId → Remove agency and creators
   ```

4. **Verify deletion:**
   ```bash
   GET /list → Verify agency no longer appears
   ```

## Database Schema Notes

**agencies table:**
- id (UUID, PK)
- user_id (UUID, FK to auth.users)
- name (TEXT)
- domain (TEXT) 
- website_url (TEXT, optional)
- industry (TEXT, optional)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_scan_at (TIMESTAMP, optional)

**agency_creators table:**
- id (UUID, PK)
- agency_id (UUID, FK)
- user_id (UUID, FK)
- creator_handle (TEXT)
- platform (TEXT enum: tiktok, youtube, instagram, twitch)
- platform_url (TEXT, optional)
- follower_count (INTEGER)
- engagement_rate (DECIMAL, optional)
- status (TEXT enum: active, inactive, archived)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_scan_at (TIMESTAMP, optional)

## RLS (Row-Level Security)

All requests are secured by RLS policies:
- `agencies_select_own` - Users can only see their own agencies
- `agency_creators_select_own` - Users can only see creators from their agencies
- `agencies_delete_own` - Users can only delete their own agencies

Authentication is required (Bearer token in Authorization header).

## Common Issues

### 401 Unauthorized
- Check that the Authorization header is set correctly
- Verify the token is valid and not expired
- Token should be: `Bearer <supabase-jwt-token>`

### 400 Bad Request
- Verify all required fields are included in the request body
- Check JSON syntax is valid
- agencyName, agencyDomain, and creators array are required for POST /save

### 404 Not Found (on DELETE)
- Agency ID doesn't exist
- You don't own the agency (RLS policy)

### 500 Internal Server Error
- Check server logs for details
- Verify Supabase connection is working
- Check SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
