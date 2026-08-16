# Vercel Environment Variable Setup

## Critical: NEXT_PUBLIC_CONVEX_URL

The Convex client requires the deployment URL to be available at **runtime** in the browser.

### Required Variable

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://chatty-camel-373.convex.cloud` | ✅ Production<br>✅ Preview<br>✅ Development |

### How to Set in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Click **Add New**
3. Enter:
   - **Name**: `NEXT_PUBLIC_CONVEX_URL`
   - **Value**: `https://chatty-camel-373.convex.cloud`
   - **Environments**: Select all three (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** your application (environment variables are injected at build time)

### Why This Matters

- `NEXT_PUBLIC_*` prefix makes the variable available to the browser
- Without it, the Convex client initializes but never connects
- `useQuery` will return `undefined` forever
- No build errors, just silent runtime failure

### Diagnostic Check

The dashboard now shows a diagnostic banner:
- ✅ Green = URL is present
- ❌ Red = URL is missing

If you see ❌ on Vercel but ✅ locally, the environment variable is not set in Vercel.

### Common Mistakes

❌ **Wrong**: Setting `CONVEX_URL` (without `NEXT_PUBLIC_` prefix)
- This is server-only and not available to the browser

❌ **Wrong**: Setting it only for Production
- Preview deployments also need it

❌ **Wrong**: Setting it but not redeploying
- Environment variables are injected at build time
- Must redeploy after adding/updating

### Verification

After setting the variable and redeploying, check:
1. The diagnostic banner shows ✅
2. Pilot mode status loads (not stuck on "Connecting...")
3. Browser console shows no connection errors
