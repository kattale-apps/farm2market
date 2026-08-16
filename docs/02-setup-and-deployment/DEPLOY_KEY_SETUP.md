# Convex Deploy Key Setup Guide

## Step 1: Get Deploy Key from Convex Dashboard

1. **Go to Convex Dashboard Settings:**
   - URL: https://dashboard.convex.dev/d/adamant-armadillo-601/settings
   - Or navigate: Dashboard → dev-farm2market → Settings

2. **Find Deploy Keys Section:**
   - Look for "Deploy Keys" or "API Keys" section
   - Click "Generate Deploy Key" or "Create API Key"

3. **Copy the Deploy Key:**
   - The key will look like: `convex_xxxxx...` or similar
   - **Important:** Copy it immediately - you may not be able to see it again!

---

## Step 2: Set Deploy Key and Deploy

### Option A: Set for Current Session (Temporary)

```powershell
# Set the deploy key (replace with your actual key)
$env:CONVEX_DEPLOY_KEY = "your-deploy-key-here"

# Deploy to dev
npm run deploy:dev
```

### Option B: Set Permanently (Recommended)

```powershell
# Set system environment variable (requires admin)
[System.Environment]::SetEnvironmentVariable("CONVEX_DEPLOY_KEY", "your-deploy-key-here", "User")

# Then deploy
npm run deploy:dev
```

### Option C: Add to .env.local (Alternative)

Add this line to your `.env.local` file:
```
CONVEX_DEPLOY_KEY=your-deploy-key-here
```

Then deploy:
```powershell
npm run deploy:dev
```

---

## Step 3: Verify Deployment

After deployment completes:

1. **Check Convex Dashboard:**
   - Go to: https://dashboard.convex.dev/d/adamant-armadillo-601
   - Verify functions are deployed

2. **Test Frontend:**
   - Visit: https://farm2market-dev.vercel.app
   - Verify it connects to Convex backend

---

## Troubleshooting

### Error: "MissingAccessToken"
- Make sure `CONVEX_DEPLOY_KEY` is set correctly
- Verify the key hasn't expired
- Try generating a new key

### Error: "Unauthorized"
- Check that the deploy key is for the correct deployment (`adamant-armadillo-601`)
- Verify you have access to the Convex project

### Key Not Found in Dashboard
- Some Convex projects may use different authentication methods
- Try using `npx convex dev` to authenticate, then deploy in a separate terminal

---

## Quick Reference

**Deployment URL:** https://adamant-armadillo-601.convex.cloud  
**Dashboard:** https://dashboard.convex.dev/d/adamant-armadillo-601  
**Settings:** https://dashboard.convex.dev/d/adamant-armadillo-601/settings
