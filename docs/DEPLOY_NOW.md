# 🚀 Deploy Now - Quick Commands

## ✅ Pre-Deployment Checklist

- [x] Build successful (`npm run build`)
- [x] Convex codegen successful (`npx convex codegen`)
- [x] All TypeScript errors fixed
- [x] Git repository configured

## Step 1: Commit and Push to GitHub

```powershell
# Add all changes
git add .

# Commit
git commit -m "Deploy: UX Extensions v1.2 - Complete implementation with all 15 features"

# Push to GitHub (you're on develop branch)
git push origin develop

# Or merge to main and push
# git checkout main
# git merge develop
# git push origin main
```

## Step 2: Deploy to Convex

```powershell
# Make sure you're logged in
npx convex login

# Deploy to Convex
npx convex deploy --yes
```

**⚠️ IMPORTANT**: Copy the Convex deployment URL (e.g., `https://your-project.convex.cloud`) - you'll need it for Vercel!

## Step 3: Deploy to Vercel

### Option A: Via Vercel CLI

```powershell
# Install Vercel CLI (if not installed)
npm install -g vercel

# Login
vercel login

# Deploy to production
vercel --prod
```

### Option B: Via Vercel Dashboard (Recommended)

1. Go to: **https://vercel.com/new**
2. **Import** your GitHub repository: `ITMusumba/my-app`
3. **Configure**:
   - Framework: Next.js (auto-detected)
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`
4. **Environment Variables** (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_CONVEX_URL` = `https://your-project.convex.cloud` (from Step 2)
   - `NEXT_PUBLIC_DEPLOYMENT_MODE` = `production`
5. **Deploy**: Click "Deploy"

## Step 4: Verify Deployment

1. **Convex Dashboard**: https://dashboard.convex.dev
   - Check all tables exist
   - Test a query

2. **Vercel**: Visit your deployment URL
   - Should load without errors
   - Login page should appear

3. **GitHub**: https://github.com/ITMusumba/my-app
   - All files committed
   - Code up to date

## Quick One-Liner (After Setup)

```powershell
git add .; git commit -m "Deploy"; git push origin develop; npx convex deploy --yes
```

Then configure Vercel environment variables and deploy.

## Post-Deployment

1. Create SuperAdmin user
2. Create location hierarchy (districts, subcounties, parishes)
3. Create storage locations
4. Create produce options
5. Configure system settings

---

**Need help?** See `DEPLOYMENT_GUIDE.md` for detailed instructions.
