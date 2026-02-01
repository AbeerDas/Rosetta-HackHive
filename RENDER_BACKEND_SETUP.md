# Render Backend Setup Guide

## Current Issue: 502 Bad Gateway & CORS Errors

You're seeing these errors because:
1. ❌ **CORS not configured** - Backend doesn't allow requests from Vercel domain
2. ❌ **Backend not deployed or missing env vars** - 502 Bad Gateway suggests deployment issue

## Step 1: Check Render Deployment Status

1. Go to your Render dashboard: https://render.com/dashboard
2. Find your `rosetta-backend` service
3. Check the **Status**:
   - ✅ **Running/Live** → Good, proceed to Step 2
   - ⚠️ **Building** → Wait for deployment to complete
   - ❌ **Failed/Suspended** → Check logs and fix errors

## Step 2: Set Required Environment Variables

Your Render service **requires** these environment variables to work:

### Critical Environment Variables:

```bash
# 1. Pinecone Vector Database
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=rosetta-documents

# 2. Convex Backend URL
CONVEX_URL=https://perceptive-tortoise-109.convex.site

# 3. OpenRouter for LLM Note Generation
OPENROUTER_API_KEY=your_openrouter_api_key_here

# 4. ElevenLabs for Text-to-Speech (optional)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### How to Set in Render Dashboard:

1. Go to your service → **Environment** tab
2. Click **Add Environment Variable**
3. Add each variable with its value
4. Click **Save Changes** (this will trigger a redeploy)

## Step 3: Verify CORS is Fixed

After the latest commit, CORS is now configured to allow:
- ✅ `https://rosetta-hack-hive.vercel.app` (production)
- ✅ `https://rosetta-hack-hive-git-main-*.vercel.app` (git branch previews)
- ✅ `http://localhost:5173` (local development)
- ✅ `http://localhost:3000` (local development)

**This fix requires a redeploy**, which will happen automatically when you push the commit.

## Step 4: Test Backend Connectivity

After Render redeploys with environment variables:

### Test 1: Health Check
```bash
curl https://rosetta-hackhive.onrender.com/api/v1/health
```

**Expected**:
```json
{"status":"healthy","message":"Rosetta API is running","version":"1.0.0"}
```

### Test 2: Warmup Endpoint
```bash
curl https://rosetta-hackhive.onrender.com/api/v1/health/warmup
```

**Expected**:
```json
{
  "status":"healthy",
  "message":"Backend warmed up. Loaded: bge-base-en-v1.5 (Embedding), TinyBERT (Reranker), KeyBERT (Keyword Extraction). Took Xms.",
  "models_loaded":["bge-base-en-v1.5 (Embedding)","TinyBERT (Reranker)","KeyBERT (Keyword Extraction)"],
  "warmup_duration_ms":1234
}
```

### Test 3: CORS Headers
```bash
curl -I -X OPTIONS https://rosetta-hackhive.onrender.com/api/v1/health \
  -H "Origin: https://rosetta-hack-hive.vercel.app" \
  -H "Access-Control-Request-Method: GET"
```

**Expected** (in headers):
```
Access-Control-Allow-Origin: https://rosetta-hack-hive.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
```

## Step 5: Update Vercel Environment Variables

Make sure these are set in **Vercel Dashboard** → **Settings** → **Environment Variables**:

```bash
VITE_CONVEX_URL=https://perceptive-tortoise-109.convex.site
VITE_FASTAPI_URL=https://rosetta-hackhive.onrender.com
```

Then **redeploy** Vercel (or push a commit to trigger auto-deploy).

## Troubleshooting

### Still seeing CORS errors after deploy?

**Check Render logs**:
```
Render Dashboard → Your Service → Logs
```

Look for:
- ✅ `Starting Rosetta API...`
- ✅ `Using Convex + Pinecone for all data storage`
- ❌ Any error messages about missing environment variables

### 502 Bad Gateway persists?

**Possible causes**:
1. Missing environment variables (Pinecone, Convex, OpenRouter)
2. ML models failing to load (memory issues)
3. Render service suspended (free tier limits)

**Check**:
```bash
# See if service is responding at all
curl https://rosetta-hackhive.onrender.com/

# Should return:
# {"name":"Rosetta API","version":"1.0.0","docs":null}
```

### Backend keeps "waking up"?

This is **normal** on Render's free tier:
- Services spin down after 15 minutes of inactivity
- First request triggers cold start (15-90 seconds)
- Subsequent requests are fast

The frontend handles this gracefully with the `BackendWarmingUp` component.

## Expected Timeline

1. **Now**: Push CORS fixes
2. **~5 min**: Render auto-deploys from GitHub
3. **After deploy**: Set environment variables in Render
4. **~5 min**: Render redeploys with new env vars
5. **Test**: All endpoints should work
6. **Vercel**: Frontend should connect successfully

## Final Checklist

- [ ] CORS origins include Vercel domain ✅ (fixed in latest commit)
- [ ] Render service is deployed and running
- [ ] All environment variables set in Render
- [ ] Backend health check returns 200 OK
- [ ] Backend warmup endpoint works
- [ ] CORS headers present in OPTIONS requests
- [ ] Vercel has `VITE_FASTAPI_URL` set
- [ ] Vercel has `VITE_CONVEX_URL` set
- [ ] Frontend can reach backend (no CORS errors)
