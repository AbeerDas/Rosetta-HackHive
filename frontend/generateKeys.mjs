// Generate JWT keys for Convex Auth
// Run: node generateKeys.mjs

import { generateKeyPair, exportPKCS8, exportJWK } from "jose";

async function generateKeys() {
  const keys = await generateKeyPair("RS256", { extractable: true });
  
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  
  const jwks = JSON.stringify({ 
    keys: [{ use: "sig", ...publicKey }] 
  });
  
  console.log("\n=== Copy these to your Convex Dashboard ===\n");
  console.log("1. Go to: https://dashboard.convex.dev");
  console.log("2. Select your project");
  console.log("3. Go to Settings -> Environment Variables");
  console.log("4. Add these variables:\n");
  
  console.log("JWT_PRIVATE_KEY=");
  console.log(privateKey.trimEnd().replace(/\n/g, " "));
  console.log("\nJWKS=");
  console.log(jwks);
  
  console.log("\n=== Done! ===\n");
}

generateKeys().catch(console.error);
