# Vercel Dev Project Setup Guide

## Quick Setup Steps

### 1. Go to Vercel Dashboard
Visit: https://vercel.com/dashboard

### 2. Create New Project
- Click **"Add New Project"** button
- **Import** your repository (same repository as pilot)

### 3. Configure Project

**Basic Settings:**
- **Project Name**: `farm2market-dev`
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: `./` (leave as default)
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

**⚠️ IMPORTANT - Production Branch:**
- Set **Production Branch** to: `develop`
- This ensures dev project only deploys from develop branch

### 4. Set Environment Variables (BEFORE Deploying)

Click on **"Environment Variables"** section and add:

#### Variable 1:
- **Name**: `NEXT_PUBLIC_CONVEX_URL`
- **Value**: `https://adamant-armadillo-601.convex.cloud`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development (select all)

#### Variable 2:
- **Name**: `NEXT_PUBLIC_DEPLOYMENT_MODE`
- **Value**: `dev`
- **Environments**: ✅ Production, ✅ Preview, ✅ Development (select all)

### 5. Deploy

Click **"Deploy"** button

---

## Verification

After deployment:

1. **Visit your dev Vercel URL** (shown after deployment completes)

2. **Open browser console** (F12 → Console tab)

3. **Look for these logs:**
   ```
   [DEV] Creating Convex client with URL: https://adamant-armadillo-601.convex.cloud
   [DEV] Convex client created successfully
   [DEV] Rendering with ConvexProvider
   ```

4. **Check dashboard** - Should show "Connected" status

---

## Troubleshooting

### Issue: Still shows pilot mode
- Check environment variables in Vercel
- Make sure `NEXT_PUBLIC_DEPLOYMENT_MODE=dev` is set
- Redeploy after updating environment variables

### Issue: Wrong Convex URL
- Verify `NEXT_PUBLIC_CONVEX_URL` is set to `https://adamant-armadillo-601.convex.cloud`
- Check for typos in the URL
- Redeploy after fixing

### Issue: Deployment fails
- Check that you're on `develop` branch
- Verify environment variables are set correctly
- Check Vercel build logs for errors

---

## Environment Variables Summary

### Dev Vercel Project
```
NEXT_PUBLIC_CONVEX_URL=https://adamant-armadillo-601.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=dev
```

### Pilot Vercel Project (Keep unchanged)
```
NEXT_PUBLIC_CONVEX_URL=https://chatty-camel-373.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=pilot
```

---

## Next Steps After Vercel Setup

1. ✅ Dev Convex deployment created
2. ✅ Dev Vercel project created
3. ⏳ Deploy Convex functions to dev (optional):
   ```bash
   npm run deploy:dev
   ```
4. ⏳ Start developing on `develop` branch!

---

## Quick Reference

- **Dev Convex URL**: `https://adamant-armadillo-601.convex.cloud`
- **Dev Dashboard**: https://dashboard.convex.dev/d/adamant-armadillo-601
- **Branch**: `develop`
- **Deployment Mode**: `dev`
