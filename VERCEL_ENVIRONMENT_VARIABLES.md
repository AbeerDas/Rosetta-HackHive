# Vercel Environment Variables Setup

## Required Environment Variables

After deploying to Vercel, you **must** set these environment variables in the Vercel dashboard:

### 1. Convex Configuration
```
VITE_CONVEX_URL=https://perceptive-tortoise-109.convex.site
```
(Your actual Convex deployment URL)

### 2. FastAPI Backend Configuration
```
VITE_FASTAPI_URL=https://rosetta-hackhive.onrender.com
```
(Your Render backend URL - **CRITICAL** for translation, RAG, and document processing to work)

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard: https://vercel.com/abeers-projects-f09fd044/rosetta-hack-hive
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - **Key**: `VITE_CONVEX_URL`
   - **Value**: `https://perceptive-tortoise-109.convex.site`
   - **Environments**: Select all (Production, Preview, Development)
   - Click **Save**
   
4. Repeat for `VITE_FASTAPI_URL`:
   - **Key**: `VITE_FASTAPI_URL`
   - **Value**: `https://rosetta-hackhive.onrender.com`
   - **Environments**: Select all (Production, Preview, Development)
   - Click **Save**

5. **Redeploy** your application:
   - Go to **Deployments** tab
   - Click the three dots (...) on the latest deployment
   - Click **Redeploy**
   - Or push a new commit to trigger automatic deployment

## Verification

After redeployment with environment variables set:

✅ **Translation should work** - The translate button will be enabled and functional
✅ **Document processing should work** - Uploaded PDFs will be processed for RAG
✅ **RAG citations should work** - Speaking will trigger relevant citations
✅ **Note generation should work** - Generate notes from transcripts

## Troubleshooting

### "The server is waking up" message
- **Cause**: `VITE_FASTAPI_URL` is not set or incorrect
- **Fix**: Ensure the environment variable points to your Render backend URL
- **Note**: First request may still show this due to Render cold start (15-90 seconds)

### Translation button disabled
- **Cause**: Frontend can't reach the FastAPI backend
- **Fix**: 
  1. Check `VITE_FASTAPI_URL` is set correctly
  2. Verify Render backend is running: `curl https://rosetta-hackhive.onrender.com/api/v1/health`
  3. Check Render environment variables are set (Pinecone, Convex, etc.)

### 404 on page reload
- **Cause**: Missing SPA rewrite rules in `vercel.json`
- **Fix**: Already fixed in latest commit - rewrites all routes to `/index.html`

### Images/icons not showing
- **Cause**: Assets not in `public/` folder
- **Fix**: Already fixed - all icons copied to `frontend/public/icons/`
