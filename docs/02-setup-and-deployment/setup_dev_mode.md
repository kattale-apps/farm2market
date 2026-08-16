# Setting Up Dev Mode - Step by Step Guide

This guide walks you through setting up the dev deployment mode **without affecting your existing pilot deployment**.

## Prerequisites

- ✅ Pilot mode is already working (current setup)
- ✅ You have access to Convex dashboard
- ✅ You have access to Vercel dashboard

## Current State

**Pilot Deployment (Existing - DO NOT CHANGE):**
- Convex URL: `https://chatty-camel-373.convex.cloud`
- Mode: `pilot` (defaults if not set)
- Status: ✅ Working

**Dev Deployment (New - We'll create this):**
- Convex URL: `https://dev-xxx.convex.cloud` (to be created)
- Mode: `dev`
- Status: ⏳ To be set up

---

## Step 1: Create Dev Convex Deployment

1. **Open terminal in your project root**

2. **Create a new Convex project for dev:**
   ```bash
   npx convex dev --project-name dev-farm2market
   ```

3. **Follow the prompts:**
   - It will ask you to log in if not already logged in
   - It will create a new Convex project
   - **IMPORTANT**: Note the deployment URL it provides (e.g., `https://dev-xxx.convex.cloud`)

4. **Deploy your Convex functions to dev:**
   ```bash
   npx convex deploy --project-name dev-farm2market
   ```

5. **Verify deployment:**
   - Go to https://dashboard.convex.dev
   - You should see two projects:
     - `pilot-farm2market` (your existing pilot)
     - `dev-farm2market` (new dev project)

---

## Step 2: Create Dev Vercel Project

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Click "Add New Project"**

3. **Import your repository** (same repository as pilot)

4. **Configure the project:**
   - **Project Name**: `farm2market-dev` (or any name you prefer)
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

5. **Configure Environment Variables** (BEFORE deploying):
   - Click "Environment Variables" section
   - Add the following:
     
     | Name | Value | Environment |
     |------|-------|-------------|
     | `NEXT_PUBLIC_CONVEX_URL` | `https://dev-xxx.convex.cloud` | Production, Preview, Development |
     | `NEXT_PUBLIC_DEPLOYMENT_MODE` | `dev` | Production, Preview, Development |
   
   ⚠️ **IMPORTANT**: Use the dev Convex URL from Step 1, NOT the pilot URL!

6. **Configure Git Branch** (optional but recommended):
   - In project settings, set **Production Branch** to `develop` (or create a `develop` branch)
   - This ensures dev project only deploys from the develop branch

7. **Click "Deploy"**

---

## Step 3: Verify Both Deployments

### Verify Pilot Deployment (Should Still Work)

1. **Check your existing pilot Vercel project**
2. **Verify environment variables:**
   - `NEXT_PUBLIC_CONVEX_URL` should be `https://chatty-camel-373.convex.cloud`
   - `NEXT_PUBLIC_DEPLOYMENT_MODE` should be `pilot` (or not set, defaults to pilot)
3. **Visit pilot URL** - should work exactly as before

### Verify Dev Deployment

1. **Visit your new dev Vercel project URL**
2. **Open browser console** (F12)
3. **Check logs:**
   ```
   [DEV] Creating Convex client with URL: https://dev-xxx.convex.cloud
   [DEV] Convex client created successfully
   [DEV] Rendering with ConvexProvider
   ```
4. **Verify it connects** - dashboard should show "Connected" status

---

## Step 4: Update Local Development (Optional)

If you want to test dev mode locally:

1. **Create `.env.local` file** (if not exists):
   ```bash
   # For dev mode local testing
   NEXT_PUBLIC_CONVEX_URL=https://dev-xxx.convex.cloud
   NEXT_PUBLIC_DEPLOYMENT_MODE=dev
   ```

2. **Or use pilot mode locally** (default):
   ```bash
   # For pilot mode local testing
   NEXT_PUBLIC_CONVEX_URL=https://chatty-camel-373.convex.cloud
   NEXT_PUBLIC_DEPLOYMENT_MODE=pilot
   ```

3. **Restart your dev server:**
   ```bash
   npm run dev
   ```

---

## Step 5: Git Branch Strategy (Recommended)

### Option A: Use Separate Branches

1. **Create `develop` branch:**
   ```bash
   git checkout -b develop
   git push -u origin develop
   ```

2. **Configure Vercel:**
   - **Pilot project**: Production branch = `main` (or `master`)
   - **Dev project**: Production branch = `develop`

3. **Workflow:**
   ```bash
   # Work on dev features
   git checkout develop
   # ... make changes ...
   git push  # Auto-deploys to dev URL
   
   # When stable, merge to pilot
   git checkout main
   git merge develop
   git push  # Auto-deploys to pilot URL
   ```

### Option B: Use Same Branch (Manual Deployment)

- Both projects can use the same branch
- Deploy manually when needed
- Less automated but simpler

---

## Troubleshooting

### Issue: Dev deployment uses pilot Convex URL

**Solution**: Check environment variables in Vercel dev project. Make sure `NEXT_PUBLIC_CONVEX_URL` is set to the dev Convex URL.

### Issue: Changes in dev affect pilot

**Solution**: Verify you're using separate Convex deployments. Each should have its own database.

### Issue: Can't create second Convex project

**Solution**: 
- Make sure you're logged in: `npx convex login`
- Check Convex dashboard for project limits
- Use `--project-name` flag to specify a unique name

### Issue: Environment variable not updating

**Solution**: 
1. Update in Vercel Dashboard
2. **Redeploy** the project (environment variables are injected at build time)

---

## Quick Reference

### Pilot Deployment
- **Vercel Project**: Your existing project
- **Convex URL**: `https://chatty-camel-373.convex.cloud`
- **Mode**: `pilot`
- **Branch**: `main` (or `master`)

### Dev Deployment
- **Vercel Project**: New project (`farm2market-dev`)
- **Convex URL**: `https://dev-xxx.convex.cloud` (from Step 1)
- **Mode**: `dev`
- **Branch**: `develop` (recommended)

---

## Next Steps

1. ✅ Create dev Convex deployment
2. ✅ Create dev Vercel project
3. ✅ Configure environment variables
4. ✅ Test both deployments
5. ✅ Set up git branch strategy (optional)
6. ✅ Start developing in dev mode!

---

## Safety Checklist

Before proceeding, verify:

- [ ] Pilot deployment is still working
- [ ] You have the dev Convex URL written down
- [ ] You understand that dev and pilot have separate databases
- [ ] You've configured environment variables correctly in Vercel
- [ ] You've tested both deployments

**Remember**: Pilot continues running independently. Dev changes don't affect pilot.
