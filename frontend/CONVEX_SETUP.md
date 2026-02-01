# Convex Setup Instructions

## Quick Setup

To generate the Convex types and get the app running, you need to initialize Convex:

1. **Install Convex CLI** (if not already installed):
   ```bash
   npm install -g convex
   ```

2. **Run Convex dev** (this will prompt for login and setup):
   ```bash
   cd frontend
   npx convex dev
   ```

   This will:
   - Prompt you to log in to Convex (or create an account)
   - Create a new Convex project (or connect to existing)
   - Generate the `convex/_generated/` folder with API types
   - Start watching for changes

3. **In a separate terminal**, start your Vite dev server:
   ```bash
   npm run dev
   ```

## Environment Variables

After Convex setup, you'll need to add to your `.env` file:

```bash
VITE_CONVEX_URL=https://your-project.convex.cloud
```

The Convex CLI will show you the deployment URL after setup.

## OAuth Setup (Optional, for later)

To enable OAuth authentication, you'll need to:

1. Set up OAuth apps with GitHub, Google, and Apple
2. Add credentials to Convex dashboard under Environment Variables:
   - `AUTH_GITHUB_ID`
   - `AUTH_GITHUB_SECRET`
   - `AUTH_GOOGLE_ID`
   - `AUTH_GOOGLE_SECRET`
   - `AUTH_APPLE_ID`
   - `AUTH_APPLE_SECRET`

3. Set up Resend for email OTPs:
   - Get API key from https://resend.com
   - Add `AUTH_RESEND_KEY` to Convex environment variables

4. Generate JWT keys (run in Node.js):
   ```javascript
   // generateKeys.mjs
   import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
   const keys = await generateKeyPair("RS256", { extractable: true });
   const privateKey = await exportPKCS8(keys.privateKey);
   const publicKey = await exportJWK(keys.publicKey);
   const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
   console.log(`JWT_PRIVATE_KEY="${privateKey.trimEnd().replace(/\n/g, " ")}"`);
   console.log(`JWKS=${jwks}`);
   ```

   Add the output to Convex environment variables.

## Temporary Workaround

If you just want to see the app structure without full Convex setup, you can create a minimal `_generated` folder:

```bash
mkdir -p frontend/convex/_generated
touch frontend/convex/_generated/api.d.ts
touch frontend/convex/_generated/dataModel.d.ts
```

But this won't have the actual types - you'll still need to run `npx convex dev` for proper setup.
