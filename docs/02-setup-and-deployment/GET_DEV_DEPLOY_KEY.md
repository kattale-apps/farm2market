# Get Dev Deploy Key - Quick Guide

## Step 1: Open Convex Dashboard

**Direct Link:** https://dashboard.convex.dev/d/adamant-armadillo-601/settings

Or navigate:
1. Go to: https://dashboard.convex.dev
2. Select project: `dev-farm2market`
3. Click "Settings" tab
4. Look for "Deploy Keys" or "API Keys" section

---

## Step 2: Generate Deploy Key

1. **Find the Deploy Keys section** in Settings
2. **Click "Generate Deploy Key"** or **"Create API Key"**
3. **Copy the key immediately** - it may only be shown once!

The key format will be something like:
```
dev:adamant-armadillo-601|eyJ2MiI6IjhjYWE2ZmFlODgyMjQ5Mjg4ZGMwZDZmNmUzMjVhZWI0In0=
```

---

## Step 3: Deploy with the Key

Once you have the key, run:

```powershell
# Set the deploy key
$env:CONVEX_DEPLOY_KEY = "dev:adamant-armadillo-601|your-key-here"

# Deploy to dev
npm run deploy:dev
```

Or paste the key here and I'll deploy it for you!

---

## Alternative: If Deploy Keys Section Not Found

Some Convex projects may use different authentication:

1. **Try using `npx convex dev`** to authenticate:
   ```powershell
   npx convex dev
   ```
   (Keep this running in one terminal, then deploy in another)

2. **Or deploy via Convex Dashboard:**
   - Go to: https://dashboard.convex.dev/d/adamant-armadillo-601
   - Look for "Deploy" or "Functions" section
   - Use the dashboard's deploy feature

---

## Quick Links

- **Dev Dashboard:** https://dashboard.convex.dev/d/adamant-armadillo-601
- **Dev Settings:** https://dashboard.convex.dev/d/adamant-armadillo-601/settings
- **Dev Deployment URL:** https://adamant-armadillo-601.convex.cloud
