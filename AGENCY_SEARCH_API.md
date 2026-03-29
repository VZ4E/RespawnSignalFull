# Agency Search API Documentation

## Overview

The Agency Search API provides endpoints to scrape agency websites for creator rosters, verify creator handles, and manage saved agencies and their tracked creators.

### Base URL
```
/api/agency-search
```

### Authentication
All endpoints require valid user authentication via JWT token in the `Authorization` header.

---

## Endpoints

### 1. POST `/scrape`
**Scrape creator handles from an agency website using Perplexity Sonar**

#### Request
```json
{
  "url": "https://agency.com/talent",
  "domain": "agency.com"  // optional, auto-extracted if omitted
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "agencyName": "Agency",
  "agencyDomain": "agency.com",
  "creators": [
    {
      "handle": "tiktok_creator_1",
      "name": "Creator One",
      "platforms": ["tiktok", "youtube"],
      "followerCount": 2500000,
      "verified": false
    },
    {
      "handle": "instagram_creator_2",
      "name": "Creator Two",
      "platforms": ["instagram"],
      "followerCount": 950000,
      "verified": false
    }
  ],
  "count": 2
}
```

#### Error Responses
- `400 Bad Request` - Missing or invalid `url`
- `429 Too Many Requests` - Perplexity API rate limit exceeded
- `500 Internal Server Error` - Scrape failed or Perplexity API key not configured

#### How It Works
1. Normalizes the input URL (adds `https://` if missing)
2. Sends the URL to Perplexity Sonar with a prompt to extract creator information
3. Parses the JSON response to extract handles, platforms, and follower counts
4. Returns up to 50 creators per scrape
5. Sets `verified: false` initially (verification is a separate step)

---

### 2. POST `/verify`
**Verify that creator handles actually exist on social media platforms**

#### Request
```json
{
  "creators": [
    {
      "handle": "creator_handle",
      "platforms": ["tiktok", "youtube"]
    }
  ]
}
```

#### Response (200 OK)
```json
{
  "verified": [
    {
      "handle": "creator_handle",
      "platforms": ["tiktok", "youtube"],
      "exists": false,
      "verified": false,
      "reason": "Verification pending API integration"
    }
  ],
  "verified_count": 0,
  "total": 1
}
```

#### Note
Currently returns mock verification data. This will be wired to TikTok, YouTube, Instagram, and Twitch APIs in a future update.

---

### 3. POST `/save`
**Save an agency and its tracked creators to the database**

#### Request
```json
{
  "agencyName": "Creative Agency",
  "agencyDomain": "agency.com",
  "creators": [
    {
      "handle": "creator1",
      "platforms": ["tiktok", "youtube"],
      "followerCount": 2500000
    },
    {
      "handle": "creator2",
      "platforms": ["instagram"],
      "followerCount": 950000
    }
  ]
}
```

#### Response (201 Created)
```json
{
  "agencyId": "uuid-here",
  "agencyName": "Creative Agency",
  "agencyDomain": "agency.com",
  "creatorCount": 2,
  "creators": [
    {
      "id": "creator-uuid-1",
      "handle": "creator1",
      "platforms": ["tiktok", "youtube"],
      "followerCount": 2500000
    },
    {
      "id": "creator-uuid-2",
      "handle": "creator2",
      "platforms": ["instagram"],
      "followerCount": 950000
    }
  ]
}
```

#### Database Schema
- Inserts into `agencies` table with `user_id`, `name`, `domain`, `created_at`, `updated_at`
- Inserts into `agency_creators` table with `agency_id`, `creator_handle`, `platforms`, `follower_count`, `tracked: true`, `created_at`, `updated_at`

#### Error Responses
- `400 Bad Request` - Missing required fields
- `500 Internal Server Error` - Database error

---

### 4. GET `/list`
**Retrieve all agencies and their tracked creators for the authenticated user**

#### Request
No body required.

#### Response (200 OK)
```json
{
  "agencies": [
    {
      "id": "agency-uuid",
      "name": "Creative Agency",
      "domain": "agency.com",
      "creatorCount": 2,
      "trackedCount": 2,
      "creators": [
        {
          "id": "creator-uuid",
          "creator_handle": "creator1",
          "platforms": ["tiktok", "youtube"],
          "follower_count": 2500000,
          "tracked": true,
          "created_at": "2026-03-28T01:45:00Z"
        }
      ],
      "createdAt": "2026-03-28T01:40:00Z",
      "updatedAt": "2026-03-28T01:45:00Z"
    }
  ]
}
```

---

### 5. DELETE `/:agencyId`
**Delete an agency and all of its associated creators**

#### Request
No body required.

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Agency deleted"
}
```

#### Error Responses
- `404 Not Found` - Agency doesn't exist or user doesn't own it
- `500 Internal Server Error` - Database error

---

## Data Flow

```
Frontend (3-step modal)
  ↓
POST /scrape { url }
  ↓
Perplexity Sonar extracts creators from agency page
  ↓
Parse and return creator list
  ↓
Frontend shows creators to user for approval
  ↓
User selects which creators to track
  ↓
POST /save { agencyName, agencyDomain, creators }
  ↓
Save to Supabase (agencies + agency_creators tables)
  ↓
Return savedAgency with IDs
  ↓
Frontend adds agency card to main tab view
```

---

## Database Schema

### `agencies` table
```sql
CREATE TABLE agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  domain text NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### `agency_creators` table
```sql
CREATE TABLE agency_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id),
  creator_handle text NOT NULL,
  platforms jsonb NOT NULL DEFAULT '[]',
  follower_count integer DEFAULT 0,
  tracked boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

---

## Environment Variables Required

```
PERPLEXITY_KEY=sk_your_perplexity_api_key
```

---

## Error Handling

All endpoints return errors in this format:
```json
{
  "error": "Human-readable error message",
  "details": "Technical details (if applicable)"
}
```

### Common Error Codes
- `400` - Bad request (missing/invalid parameters)
- `401` - Unauthorized (missing auth token)
- `404` - Not found
- `429` - Rate limited
- `500` - Server error

---

## Frontend Integration Points

The API is designed to integrate with the frontend modal workflow:

1. **Step 1 (Input):** User enters agency URL → Call `POST /scrape`
2. **Step 2 (Review):** Show returned creators → User selects which to track
3. **Step 3 (Confirm):** User clicks "Save & Scan Now" → Call `POST /save`
4. **Main View:** Load agencies → Call `GET /list`
5. **Delete:** User clicks delete on agency card → Call `DELETE /:agencyId`

---

## Future Integration Opportunities

- **Creator Verification:** Wire `/verify` endpoint to TikTok, YouTube, Instagram, Twitch APIs
- **Creator Discovery:** Add `/discover` endpoint for "Creator → Agency Roster" mode (reverse lookup)
- **Bulk Scanning:** Wire saved creators to existing scan pipeline
- **Alert Auto-Subscription:** Auto-subscribe approved creators to alerts system

---

**Last Updated:** 2026-03-28
**Status:** Ready for frontend integration
