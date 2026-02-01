# Convex Auth Setup Guide

## Quick Setup Steps

### 1. Add JWT Keys to Convex Dashboard

**The keys have been generated!** Copy them from the terminal output above.

1. Go to **[Convex Dashboard](https://dashboard.convex.dev)**
2. Select your project: **rosetta-a1c4b**
3. Navigate to: **Settings → Environment Variables**
4. Click **Add Variable** and add both:

```
JWT KEY
```

**IMPORTANT:** Also add the SITE_URL environment variable:

```
SITE_URL=http://localhost:5173
```

(Change to your production URL when deploying, e.g., `https://rosetta.app`)

5. Click **Save**

---

### 2. Configure OAuth Providers (Optional)

OAuth is **optional** - you can skip this and just use email/password for now.

#### For GitHub OAuth:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: Rosetta
   - **Homepage URL**: `http://localhost:5173`
   - **Authorization callback URL**: `https://perceptive-tortoise-109.convex.site/api/auth/callback/github`
4. Click **Register application**
5. Copy **Client ID** and generate a **Client secret**
6. Add to Convex Dashboard:
   ```
   AUTH_GITHUB_ID=your_client_id
   AUTH_GITHUB_SECRET=your_client_secret
   ```

#### For Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select existing
3. Enable Google+ API
4. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
5. Choose **Web application**
6. Add authorized redirect URI:
   - `https://perceptive-tortoise-109.convex.site/api/auth/callback/google`
7. Copy **Client ID** and **Client secret**
8. Add to Convex Dashboard:
   ```
   ```

**✅ CONFIGURED** - These credentials are ready to use!

#### For Apple OAuth:

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create a **Services ID**
3. Configure Sign in with Apple
4. Add redirect URL:
   - `https://perceptive-tortoise-109.convex.site/api/auth/callback/apple`
5. Generate a key
6. Add to Convex Dashboard:
   ```
   AUTH_APPLE_ID=your_services_id
   AUTH_APPLE_SECRET=your_key
   ```

---

### 3. Configure Resend for Email (Optional)

Email verification is **optional** - password authentication will work without it.

1. Go to [Resend](https://resend.com/)
2. Sign up and get an API key
3. Add to Convex Dashboard:
   ```
   AUTH_RESEND_KEY=re_your_api_key
   ```

---

## Testing Authentication

### Email/Password (Works Now!)

After adding the JWT keys above, you can immediately test:

1. Refresh your app at `http://localhost:5173`
2. Click **Sign Up**
3. Enter email and password (no verification needed for dev)
4. Click **Sign Up**

✅ **Should work after adding JWT keys!**

---

### OAuth (Optional)

After configuring OAuth providers above:

1. Click **Continue with GitHub/Google/Apple**
2. Authorize the app
3. Get redirected back

---

## Troubleshooting

### "Missing JWT_PRIVATE_KEY"
- ✅ **Fixed!** Just add the JWT keys from above to Convex Dashboard

### "OAuth client not found"
- OAuth providers need to be configured (see step 2)
- Or just use email/password for now

### "Email verification required"
- Currently disabled for simplicity
- Will add back later with Resend integration

---

## Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Email/Password Sign Up | ✅ Ready | Just add JWT keys above |
| Email/Password Sign In | ✅ Ready | Works immediately |
| GitHub OAuth | ⚠️ Optional | Requires GitHub app setup |
| Google OAuth | ✅ Configured | Credentials ready - add to Convex Dashboard |
| Apple OAuth | ⚠️ Optional | Requires Apple Developer setup |
| Email Verification | ⏸️ Disabled | Will add back later |
| Password Reset | ⏸️ Disabled | Will add back later |

---

## Next Steps

1. ✅ **Add JWT keys** (see step 1 above) - **DO THIS NOW**
2. Test email/password signup
3. (Optional) Configure OAuth if you want social login
4. (Optional) Add Resend for email features

**After adding the JWT keys, refresh your app and try signing up!**
