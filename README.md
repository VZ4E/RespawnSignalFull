# Respawn Signal

TikTok brand deal scanner SaaS — respawnmedia.co

## Stack
- Node.js + Express backend
- Supabase (auth + postgres)
- Stripe (billing — coming soon)
- Vanilla HTML/CSS/JS frontend

## Local Setup

1. **Install deps**
   ```
   npm install
   ```

2. **Set up Supabase**
   - Create a project at supabase.com
   - Go to SQL Editor and run the contents of `supabase/schema.sql`
   - Copy your Project URL and Service Role key

3. **Configure env**
   ```
   cp .env.example .env
   ```
   Fill in your values in `.env`

4. **Run locally**
   ```
   npm run dev
   ```
   App runs at http://localhost:3000

## Deploy to Railway

1. Push this repo to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Add all env vars from `.env.example` in the Railway dashboard
4. Railway auto-deploys on push

## Adding Stripe (when ready)

1. Create two products in Stripe dashboard:
   - Pro: $29/month recurring
   - Max: $79/month recurring
2. Copy the Price IDs into env vars (`STRIPE_PRO_PRICE_ID`, `STRIPE_MAX_PRICE_ID`)
3. Add your `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
4. Update `/api/billing/create-checkout` and `/api/billing/portal` in `src/routes/billing.js`

## Env Vars

| Var | Description |
|-----|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side only) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for Pro plan |
| `STRIPE_MAX_PRICE_ID` | Stripe Price ID for Max plan |
| `RAPIDAPI_KEY` | RapidAPI key for tiktok-scraper7 |
| `TRANSCRIPT24_TOKEN` | Transcript24 API token |
| `PERPLEXITY_KEY` | Perplexity AI API key |
| `PORT` | Port to run on (default 3000) |
