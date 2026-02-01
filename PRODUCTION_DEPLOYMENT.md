# Production Deployment Guide

## Architecture Overview

Rosetta uses a fully cloud-native architecture:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      Vercel (React App)                         │   │
│   │   - Next.js/Vite static hosting                                 │   │
│   │   - Edge deployment                                             │   │
│   │   - Automatic HTTPS                                             │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                │                                        │
└────────────────────────────────│────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│      Convex          │  │     Pinecone         │  │  FastAPI Backend     │
│   (Database + Auth)  │  │  (Vector Database)   │  │   (ML Services)      │
│                      │  │                      │  │                      │
│ - Sessions           │  │ - Document           │  │ - PDF Processing     │
│ - Documents          │  │   embeddings         │  │ - Embedding          │
│ - Transcripts        │  │ - Semantic search    │  │   generation         │
│ - Citations          │  │ - RAG retrieval      │  │ - Re-ranking         │
│ - Notes              │  │                      │  │ - Translation        │
│ - Users              │  │ Free tier:           │  │ - Note generation    │
│ - File storage       │  │ - 2GB storage        │  │                      │
│                      │  │ - 1M queries/mo      │  │ Deploy to:           │
│ Fully managed,       │  │ - Serverless         │  │ - Render (free)      │
│ no config needed     │  │                      │  │                      │
│                      │  │ Fully managed,       │  │ Cold start: ~20-30s  │
│                      │  │ no config needed     │  │                      │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

## Services Breakdown

### 1. Convex (Database + Auth) - Fully Managed

**What it handles:**
- User authentication (Google OAuth)
- Session management
- Document metadata
- Transcripts
- Citations
- Notes
- File storage (PDFs)

**Setup:**
- Already configured via `npx convex dev`
- Production deployment: `npx convex deploy`
- Set environment variables in Convex Dashboard

**Required Environment Variables (Convex Dashboard):**
```
AUTH_GOOGLE_ID=your-google-oauth-id
AUTH_GOOGLE_SECRET=your-google-oauth-secret
SITE_URL=https://your-production-domain.vercel.app
```

### 2. Pinecone (Vector Database) - Fully Managed

**What it handles:**
- Document embeddings (768-dimensional, bge-base-en-v1.5)
- Semantic search for RAG
- Citation retrieval

**Setup:**
1. Account already created at https://app.pinecone.io
2. Index `rosetta-documents` already created
3. API key configured

**Configuration:**
- Index: `rosetta-documents`
- Dimension: 768 (matches bge-base-en-v1.5)
- Metric: cosine
- Region: AWS us-east-1

**Free Tier Limits:**
- 2GB storage
- 1M read queries/month
- Serverless (auto-scaling)

### 3. FastAPI Backend (ML Services) - Render Free Tier

**What it handles:**
- PDF text extraction
- Embedding generation (local bge-base-en-v1.5)
- Keyword extraction (KeyBERT)
- Re-ranking (TinyBERT)
- Translation (via OpenRouter LLM)
- Note generation (via OpenRouter LLM)
- TTS (via ElevenLabs)

**Deployment: Render (Recommended for Free Tier)**

Render's free tier is ideal for this project:
- Always-free web services
- 750 instance hours per month (enough for one service 24/7)
- Automatic HTTPS
- Easy GitHub integration

**Important: Cold Start Behavior**

Render's free tier spins down services after ~15 minutes of inactivity. When a user makes a request to a sleeping service:

| Phase | Duration |
|-------|----------|
| Container boot | ~5 seconds |
| Python/FastAPI init | ~3 seconds |
| First ML model load | ~10-15 seconds |
| **Total cold start** | **~20-30 seconds** |

The frontend has been configured to:
1. Detect cold starts (timeouts, 503 errors)
2. Show a friendly "Server is waking up..." indicator
3. Automatically retry requests with exponential backoff
4. Pre-warm the backend when users navigate to ML-dependent pages

## Render Deployment Guide

### Step 1: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub (recommended for easy repo access)

### Step 2: Create Web Service

1. From the Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `rosetta-backend` |
| **Region** | Oregon (US West) or nearest to your users |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Docker |
| **Instance Type** | Free |

### Step 3: Set Environment Variables

In the Render dashboard, go to your service → **Environment** → **Add Environment Variable**:

| Variable | Value | Description |
|----------|-------|-------------|
| `PINECONE_API_KEY` | `pcsk_xxx...` | From Pinecone dashboard |
| `PINECONE_INDEX_NAME` | `rosetta-documents` | Your index name |
| `CONVEX_URL` | `https://your-project.convex.site` | From Convex dashboard |
| `OPENROUTER_API_KEY` | `sk-or-v1-xxx...` | From OpenRouter |
| `ELEVENLABS_API_KEY` | `xxx...` | From ElevenLabs |
| `ENVIRONMENT` | `production` | App environment |
| `DEBUG` | `false` | Disable debug mode |

### Step 4: Deploy

Click **"Deploy Web Service"**. Render will:
1. Clone your repository
2. Build the Docker image
3. Deploy and start the service
4. Provide a URL like `https://rosetta-backend-xxxx.onrender.com`

### Step 5: Verify Deployment

Test the health endpoints:

```bash
# Basic health check
curl https://rosetta-backend-xxxx.onrender.com/api/v1/health

# Pinecone connection
curl https://rosetta-backend-xxxx.onrender.com/api/v1/health/pinecone

# Warmup endpoint (loads ML models)
curl https://rosetta-backend-xxxx.onrender.com/api/v1/health/warmup
```

### Step 6: Update Frontend Environment

Set `VITE_FASTAPI_URL` in Vercel to your Render URL:

```
VITE_FASTAPI_URL=https://rosetta-backend-xxxx.onrender.com
```

## Alternative: Blueprint Deployment

For one-click deployment using infrastructure-as-code, use the included `render.yaml`:

1. Go to https://dashboard.render.com/blueprints
2. Click **"New Blueprint Instance"**
3. Connect your repository
4. Render will automatically detect `render.yaml` and create the service
5. Set the secret environment variables manually

## Cold Start Optimization Tips

### For Development
- Keep a terminal open with `watch -n 300 curl -s https://your-backend.onrender.com/api/v1/health`
- This pings the server every 5 minutes to prevent sleep

### For Production
If cold starts become problematic with more users, consider:
1. **Upgrade to Render Starter ($7/mo)**: No spin-down, always running
2. **Railway ($5/mo credit)**: Similar pricing, no cold starts
3. **Fly.io ($5/mo)**: Always-on VMs with better cold start behavior

### 4. Vercel (Frontend)

**Deployment:**
```bash
cd frontend
vercel deploy --prod
```

**Environment Variables:**
```
VITE_CONVEX_URL=https://your-project.convex.cloud
VITE_FASTAPI_URL=https://rosetta-backend-xxxx.onrender.com
```

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set in Convex Dashboard
- [ ] Pinecone index created and API key saved
- [ ] OpenRouter API key obtained
- [ ] ElevenLabs API key obtained
- [ ] Google OAuth credentials configured

### Backend Deployment (Render)

- [ ] Create Render account and connect GitHub
- [ ] Create Web Service with Docker runtime
- [ ] Set root directory to `backend`
- [ ] Add all environment variables
- [ ] Deploy and note the URL
- [ ] Verify health endpoint: `GET /api/v1/health`
- [ ] Verify Pinecone connection: `GET /api/v1/health/pinecone`
- [ ] Test warmup endpoint: `GET /api/v1/health/warmup`

### Convex Deployment

- [ ] Run `npx convex deploy`
- [ ] Set production environment variables
- [ ] Update SITE_URL to production domain

### Frontend Deployment

- [ ] Set VITE_FASTAPI_URL to Render backend URL
- [ ] Deploy to Vercel
- [ ] Verify OAuth login works
- [ ] Test file upload and processing
- [ ] Verify cold start UX works (test after 15+ min idle)

## Cost Estimation (Free Tier)

| Service | Free Tier | Notes |
|---------|-----------|-------|
| Convex | Generous free tier | Sufficient for MVP |
| Pinecone | 2GB, 1M queries/mo | Sufficient for MVP |
| Render | 750 hours/mo | One service 24/7 |
| Vercel | Generous free tier | Frontend hosting |
| OpenRouter | Pay per use | ~$0.001/1K tokens |
| ElevenLabs | 10K chars/mo free | TTS only |

**Estimated monthly cost for MVP: $0-5**

## Monitoring

### Health Endpoints
- `GET /api/v1/health` - Overall API health
- `GET /api/v1/health/pinecone` - Pinecone connection
- `GET /api/v1/health/elevenlabs` - ElevenLabs API
- `GET /api/v1/health/openrouter` - OpenRouter API
- `GET /api/v1/health/warmup` - Pre-load ML models (for cold start recovery)

### Logging
- Backend logs via Render dashboard (Logs tab)
- Convex logs via Convex Dashboard
- Frontend errors via Vercel dashboard

## Scaling

When you need to scale:

1. **Pinecone**: Upgrade to Starter ($70/mo) for unlimited vectors
2. **Backend**: Upgrade Render to Starter ($7/mo) for no cold starts
3. **Convex**: Automatically scales with usage
4. **Vercel**: Automatically scales

## Security Considerations

1. **API Keys**: Never commit to git, use environment variables
2. **CORS**: Configure backend CORS for production domains only
3. **Rate Limiting**: Implement at backend level if needed
4. **Auth**: All user data protected by Convex Auth

## Troubleshooting

### "Server is waking up" takes too long
- Normal for first request after 15+ min idle
- If consistently over 60 seconds, check Render logs for errors

### Document processing fails
- Check Render logs for Python errors
- Verify PINECONE_API_KEY is set correctly
- Test `/api/v1/health/pinecone` endpoint

### OAuth login fails
- Verify SITE_URL matches your Vercel domain exactly
- Check that Google OAuth redirect URIs include your domain
- Verify AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in Convex

### Citations not appearing
- Verify documents were processed successfully
- Check that embeddings exist in Pinecone
- Test the RAG pipeline with `/api/v1/health/warmup`
