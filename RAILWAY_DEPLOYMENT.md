# Deploying Respawn Signal to Railway

## Prerequisites

1. **Railway Account** - Sign up at https://railway.app
2. **GitHub Access** - Repository must be pushed to GitHub
3. **Environment Variables** - Collect all required API keys

## Step 1: Connect GitHub Repository

1. Go to https://railway.app/dashboard
2. Click "New Project" → "Deploy from GitHub"
3. Authorize Railway to access your GitHub account
4. Select the `respawn-signal` repository
5. Click "Deploy"

Railway will automatically detect `railway.json` and `Procfile` configurations.

## Step 2: Configure Environment Variables

In the Railway dashboard, go to **Variables** and add:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
STRIPE_STARTER_PRICE=price_1TEP9mBVOMJTwlq1LnkpaaXH
STRIPE_PRO_PRICE=price_1TEP9nBVOMJTwlq1AsNSiqCd
STRIPE_AGENCY_PRICE=price_1TEP9nBVOMJTwlq1Ta0wBwjd
STRIPE_TOPUP_500=price_1TEP9oBVOMJTwlq1UIoVwhTv
STRIPE_TOPUP_1500=price_1TEP9oBVOMJTwlq11ED5EViJ
STRIPE_TOPUP_3000=price_1TEP9oBVOMJTwlq1wgfx5Fov
RAPIDAPI_KEY=your_rapidapi_key
TRANSCRIPT24_TOKEN=your_transcript24_token
PERPLEXITY_KEY=your_perplexity_api_key
PORT=3000
APP_URL=https://your-railway-app.up.railway.app
```

### Getting Environment Variables

**Supabase:**
- Go to Supabase Dashboard → Settings → API
- Copy `Project URL` and `Service Role Key`

**Stripe:**
- Go to Stripe Dashboard → Developers → API Keys
- Copy Secret Key and Webhook Secret

**Other APIs:**
- Perplexity: https://www.perplexity.ai/api
- RapidAPI: https://rapidapi.com
- Transcript24: https://www.transcript24.com

## Step 3: Deploy

1. Railway should auto-deploy when you push to main
2. Check the deployment logs in the Railway dashboard
3. Wait for "Deployment Successful" message

## Step 4: Get Live URL

1. In Railway Dashboard, find your service
2. Click on the service → "Settings" → "Generate Domain"
3. Your app will be at: `https://your-app-name.up.railway.app`

## Step 5: Update Frontend

Update your frontend API calls to use the Railway URL:

```javascript
const API_BASE = 'https://your-app-name.up.railway.app/api';

// Example for Agency Search
const response = await fetch(`${API_BASE}/agency-search/list`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Testing the Deployment

### Test Health Endpoint
```bash
curl https://your-app-name.up.railway.app/health
```

### Test Agency Search API

1. **Save Agency:**
```bash
curl -X POST https://your-app-name.up.railway.app/api/agency-search/save \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agencyName": "Test Agency",
    "agencyDomain": "testagency.com",
    "creators": [
      { "handle": "creator_one", "platforms": ["tiktok"], "followerCount": 150000 }
    ]
  }'
```

2. **List Agencies:**
```bash
curl https://your-app-name.up.railway.app/api/agency-search/list \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Delete Agency:**
```bash
curl -X DELETE https://your-app-name.up.railway.app/api/agency-search/{agencyId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### Build Fails
- Check that `railway.json` and `Procfile` are present
- Verify `package.json` has correct Node version (`>=18.0.0`)
- Check build logs in Railway dashboard

### App Crashes at Runtime
- Check deployment logs for errors
- Verify all environment variables are set
- Check Supabase connection (SUPABASE_URL, SUPABASE_SERVICE_KEY)

### Slow Performance
- Check Railway logs for bottlenecks
- Monitor Supabase query performance
- Consider adding caching

## Auto-Deploy on Push

Railway automatically deploys when you push to `main` branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Check deployment status in Railway dashboard.

## Rolling Back

If a deployment fails:
1. Go to Railway Dashboard → Deployments
2. Click on a previous successful deployment
3. Click "Rollback"

## Monitoring

- **Logs:** Railway Dashboard → Logs
- **CPU/Memory:** Dashboard → Metrics
- **Error tracking:** Check logs for 5xx errors

## Database Migrations

When you push schema changes, migrations run automatically.

If migrations fail:
1. Check Rails logs
2. Verify Supabase connection
3. Run migrations manually in Supabase SQL editor if needed

## Support

- Railway Docs: https://docs.railway.app
- Troubleshooting: https://docs.railway.app/troubleshoot/common-errors
- Community: https://discord.gg/railway
