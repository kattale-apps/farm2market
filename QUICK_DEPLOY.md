# Quick Deployment Guide

## 🚀 Fast Track Deployment

Follow these steps to deploy to GitHub, Convex, and Vercel.

## Step 1: Commit and Push to GitHub

```powershell
# Add all changes
git add .

# Commit with message
git commit -m "Deploy: UX Extensions v1.2 - Complete implementation"

# Push to GitHub (you're on develop branch)
git push origin develop

# Or push to main if that's your production branch
# git checkout main
# git merge develop
# git push origin main
```

## Step 2: Deploy to Convex

```powershell
# Make sure you're logged in
npx convex login

# Deploy to Convex production
npx convex deploy --yes

# Save the deployment URL that's displayed
# Example: https://your-project.convex.cloud
```

**Important**: Copy the Convex deployment URL - you'll need it for Vercel!

## Step 3: Deploy to Vercel

### Option A: Via Vercel CLI

```powershell
# Install Vercel CLI (if not installed)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (first time will ask questions)
vercel

# Deploy to production
vercel --prod
```

### Option B: Via Vercel Dashboard (Recommended)

1. **Go to**: https://vercel.com/new
2. **Import your GitHub repository**
3. **Configure project**:
   - Framework: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. **Add Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add: `NEXT_PUBLIC_CONVEX_URL` = `https://your-project.convex.cloud` (from Step 2)
   - Add: `NEXT_PUBLIC_DEPLOYMENT_MODE` = `production`
5. **Deploy**: Click "Deploy"

## Step 4: Verify Deployment

1. **Convex**: Check https://dashboard.convex.dev
   - Verify all tables exist
   - Test a query (e.g., `getActiveDistricts`)

2. **Vercel**: Visit your deployment URL
   - Should load without errors
   - Login page should appear

3. **GitHub**: Check your repository
   - All files should be committed
   - Code should be up to date

## Environment Variables Checklist

Make sure these are set in Vercel:

- ✅ `NEXT_PUBLIC_CONVEX_URL` - Your Convex deployment URL
- ✅ `NEXT_PUBLIC_DEPLOYMENT_MODE` - Set to `production`

## Post-Deployment Setup

After deployment, you'll need to:

1. **Create SuperAdmin user** (via login page or Convex dashboard)
2. **Create location hierarchy** (districts, subcounties, parishes)
3. **Create storage locations**
4. **Create produce options**
5. **Configure system settings** (commission, fees, etc.)

## Troubleshooting

### Convex Issues
- **Schema errors**: Run `npx convex deploy --yes --force`
- **Missing functions**: Check all files are committed
- **Login issues**: Run `npx convex login` again

### Vercel Issues
- **Build fails**: Check build logs in Vercel dashboard
- **Environment variables**: Verify they're set correctly
- **404 errors**: Check Next.js routing configuration

### GitHub Issues
- **Push rejected**: Pull latest changes first: `git pull origin develop`
- **Large files**: Check `.gitignore` is working

## Quick Commands Summary

```powershell
# 1. Commit and push
git add .
git commit -m "Deploy: UX Extensions v1.2"
git push origin develop

# 2. Deploy Convex
npx convex deploy --yes

# 3. Deploy Vercel (CLI)
vercel --prod

# Or use the automated script
.\deploy.ps1
```

## Need Help?

- **Convex Docs**: https://docs.convex.dev
- **Vercel Docs**: https://vercel.com/docs
- **Full Guide**: See `DEPLOYMENT_GUIDE.md`
