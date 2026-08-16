# ✅ Dev Deployment Setup - Complete!

## Status: All Systems Ready! 🎉

### ✅ Completed Steps

1. **Dev Convex Deployment**
   - Project: `dev-farm2market`
   - Deployment: `adamant-armadillo-601`
   - URL: `https://adamant-armadillo-601.convex.cloud`
   - Dashboard: https://dashboard.convex.dev/d/adamant-armadillo-601

2. **Develop Branch**
   - ✅ Created locally
   - ✅ Pushed to GitHub
   - ✅ Synced with Vercel

3. **Dev Vercel Project**
   - Project: `farm2market-dev`
   - URL: https://farm2market-dev.vercel.app
   - Dashboard: https://vercel.com/itmusumbas-projects/farm2market-dev
   - Environment Variables: ✅ Set
   - Production Branch: ⏳ Set to `develop` (you can do this now!)

---

## Final Step: Set Production Branch

Now that `develop` is visible in Vercel:

1. Go to: https://vercel.com/itmusumbas-projects/farm2market-dev/settings/git
2. Find **"Production Branch"** dropdown
3. Select **`develop`**
4. Click **"Save"**

---

## You're All Set! 🚀

### Pilot Deployment (Unchanged)
- **Vercel**: `farm2market` project
- **Branch**: `main`
- **Convex**: `https://chatty-camel-373.convex.cloud` (or your pilot URL)
- **Mode**: `pilot`
- **Status**: ✅ Active and stable

### Dev Deployment (New)
- **Vercel**: `farm2market-dev` project
- **Branch**: `develop` (set as production branch)
- **Convex**: `https://adamant-armadillo-601.convex.cloud`
- **Mode**: `dev`
- **Status**: ✅ Ready for development

---

## Development Workflow

### Work on Dev Features:
```bash
# Switch to develop branch
git checkout develop

# Make your changes
# ... code changes ...

# Commit and push
git add .
git commit -m "Add new feature"
git push  # Auto-deploys to dev URL: https://farm2market-dev.vercel.app
```

### Deploy Convex Functions to Dev:
```bash
npm run deploy:dev
```

### When Ready for Pilot:
```bash
# Switch to main branch
git checkout main

# Merge develop into main
git merge develop

# Push to main
git push  # Auto-deploys to pilot URL

# Deploy Convex functions to pilot
npm run deploy:pilot
```

---

## Quick Reference

### URLs
- **Dev**: https://farm2market-dev.vercel.app
- **Dev Dashboard**: https://vercel.com/itmusumbas-projects/farm2market-dev
- **Dev Convex**: https://dashboard.convex.dev/d/adamant-armadillo-601

### Commands
- `npm run deploy:dev` - Deploy Convex to dev
- `npm run deploy:pilot` - Deploy Convex to pilot
- `git checkout develop` - Switch to dev branch
- `git checkout main` - Switch to pilot branch

---

## What's Next?

1. ✅ Set production branch to `develop` in Vercel (final step)
2. 🚀 Start developing features on `develop` branch
3. 🧪 Test in dev environment
4. 📦 Merge to `main` when ready for pilot

**You're ready to start building!** 🎉
