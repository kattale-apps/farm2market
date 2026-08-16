# Troubleshooting Convex Connection Issues

## Symptoms

- ✅ Convex URL banner shows URL is present
- ✅ Build compiles successfully
- ❌ Error persists (query never resolves, stuck on "Connecting...")

## Diagnostic Steps

### 1. Check Browser Console

Open browser DevTools (F12) → Console tab. Look for:

**Expected logs:**
```
Creating Convex client with URL: https://...
Convex client created successfully
Rendering with ConvexProvider
Attempting to query pilotMode: { hasApi: true, hasPilotMode: true, ... }
```

**If you see errors:**
- `Failed to create Convex client` → URL format issue
- `Convex client is null` → Client creation failed
- Network errors → CORS or connection issue

### 2. Verify Deployment URL Match

**Check what you deployed to:**
```bash
npx convex deploy --dry-run
```

**Check what URL is set in Vercel:**
- Vercel Dashboard → Settings → Environment Variables
- Should match the deployment URL

**Common mismatch:**
- Deployed to: `https://amicable-dotterel-244.convex.cloud`
- Vercel URL set to: `https://chatty-camel-373.convex.cloud`
- ❌ These don't match!

### 3. Check Network Tab

Open DevTools → Network tab:
- Filter by "convex" or "websocket"
- Look for connection attempts
- Check if requests are failing (red status)

### 4. Verify Query Function Exists

In browser console, run:
```javascript
// Should return the function reference
window.__CONVEX_API__?.pilotMode?.getPilotMode
```

### 5. Common Issues

#### Issue: URL Mismatch
**Symptom:** Client connects but queries fail
**Fix:** Update `NEXT_PUBLIC_CONVEX_URL` in Vercel to match actual deployment

#### Issue: CORS Error
**Symptom:** Network tab shows CORS errors
**Fix:** Check Convex dashboard → Settings → Allowed Origins

#### Issue: Function Not Deployed
**Symptom:** Query returns error about missing function
**Fix:** Run `npx convex deploy` to deploy functions

#### Issue: Wrong Environment
**Symptom:** Works locally but not on Vercel
**Fix:** Ensure environment variable is set for Production/Preview

## Next Steps

After checking console logs, share:
1. What errors appear in console
2. What the deployment URL is (from `npx convex deploy --dry-run`)
3. What URL is set in Vercel environment variables
4. Any network errors in Network tab
