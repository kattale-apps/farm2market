# ✅ Dev Deployment Setup Complete!

## What Was Created

### Dev Vercel Project ✅
- **Project Name**: `farm2market-dev`
- **Production URL**: https://farm2market-dev.vercel.app
- **Project Dashboard**: https://vercel.com/itmusumbas-projects/farm2market-dev
- **Status**: ✅ Deployed and Live

### Environment Variables ✅
- `NEXT_PUBLIC_CONVEX_URL` = `https://adamant-armadillo-601.convex.cloud`
- `NEXT_PUBLIC_DEPLOYMENT_MODE` = `dev`
- Set for: Production, Preview, Development ✅

### Dev Convex Deployment ✅
- **Project**: `dev-farm2market`
- **Deployment**: `adamant-armadillo-601`
- **URL**: `https://adamant-armadillo-601.convex.cloud`
- **Dashboard**: https://dashboard.convex.dev/d/adamant-armadillo-601

---

## Next Step: Configure Production Branch

**Important**: Set the production branch to `develop` so dev project only deploys from develop branch.

### Via Vercel Dashboard:
1. Go to: https://vercel.com/itmusumbas-projects/farm2market-dev/settings/git
2. Find **"Production Branch"** setting
3. Change from `main` to `develop`
4. Save

### Via CLI (if supported):
```bash
# This might require Vercel API - check dashboard for now
```

---

## Verification

### Test Dev Deployment:
1. **Visit**: https://farm2market-dev.vercel.app
2. **Open**: Browser console (F12)
3. **Look for**:
   ```
   [DEV] Creating Convex client with URL: https://adamant-armadillo-601.convex.cloud
   [DEV] Convex client created successfully
   ```

### Test Pilot Deployment:
- Your existing pilot project should still work at its URL
- It uses: `https://chatty-camel-373.convex.cloud` (or your pilot URL)

---

## Current Setup Summary

### Pilot Deployment ✅
- **Vercel Project**: `farm2market` (existing)
- **Branch**: `main`
- **Convex URL**: `https://chatty-camel-373.convex.cloud` (or your pilot URL)
- **Mode**: `pilot`
- **Status**: ✅ Active

### Dev Deployment ✅
- **Vercel Project**: `farm2market-dev` (new)
- **Branch**: `develop` (needs to be set as production branch)
- **Convex URL**: `https://adamant-armadillo-601.convex.cloud`
- **Mode**: `dev`
- **Status**: ✅ Active

---

## Workflow

### Develop Features:
```bash
# Work on develop branch
git checkout develop
# Make changes
git add .
git commit -m "Add new feature"
git push  # Auto-deploys to dev URL
```

### Deploy Convex Functions to Dev:
```bash
npm run deploy:dev
```

### When Ready for Pilot:
```bash
git checkout main
git merge develop
git push  # Auto-deploys to pilot URL
npm run deploy:pilot
```

---

## Quick Links

- **Dev Vercel**: https://vercel.com/itmusumbas-projects/farm2market-dev
- **Dev URL**: https://farm2market-dev.vercel.app
- **Dev Convex Dashboard**: https://dashboard.convex.dev/d/adamant-armadillo-601
- **Pilot Vercel**: https://vercel.com/itmusumbas-projects/farm2market

---

## 🎉 Success!

Your dev deployment is live and ready for development! Both pilot and dev run independently with separate databases and URLs.
