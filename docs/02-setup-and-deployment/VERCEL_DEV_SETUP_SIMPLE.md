# Simple Vercel Dev Setup - Step by Step

## Option 1: Using Vercel Dashboard (Recommended)

Since you already have access to https://vercel.com/itmusumbas-projects/farm2market, follow these steps:

### Step 1: Create New Project

1. **Go to**: https://vercel.com/dashboard
2. **Click**: The **"Add New..."** button (top right) or **"Add New Project"**
3. **Click**: **"Import Git Repository"**
4. **Select**: Your repository (same one as `farm2market`)

### Step 2: Configure Project

**Project Settings:**
- **Project Name**: Type `farm2market-dev` (to distinguish from pilot)
- **Framework Preset**: Next.js (should auto-detect)
- **Root Directory**: Leave as `./` (default)
- **Build Command**: Leave as `npm run build` (default)
- **Output Directory**: Leave as `.next` (default)
- **Install Command**: Leave as `npm install` (default)

**⚠️ CRITICAL - Before clicking Deploy:**

### Step 3: Set Production Branch

1. **Look for**: "Production Branch" or "Git" section
2. **Change from**: `main` (or `master`)
3. **Change to**: `develop`
4. This ensures dev project only deploys from develop branch

### Step 4: Add Environment Variables (BEFORE Deploying!)

**Before clicking "Deploy", click on "Environment Variables" section:**

Add these two variables:

#### Variable 1:
- **Key**: `NEXT_PUBLIC_CONVEX_URL`
- **Value**: `https://adamant-armadillo-601.convex.cloud`
- **Environments**: 
  - ✅ Production
  - ✅ Preview  
  - ✅ Development
- Click **"Add"**

#### Variable 2:
- **Key**: `NEXT_PUBLIC_DEPLOYMENT_MODE`
- **Value**: `dev`
- **Environments**:
  - ✅ Production
  - ✅ Preview
  - ✅ Development
- Click **"Add"**

### Step 5: Deploy

1. **Click**: **"Deploy"** button
2. **Wait**: For deployment to complete
3. **Note**: Your dev URL (will be something like `farm2market-dev.vercel.app`)

---

## Option 2: Using Vercel CLI

If dashboard doesn't work, use CLI:

### Step 1: Login
```bash
npx vercel login
```
Follow the prompts to login in your browser.

### Step 2: Create Project
```bash
# Make sure you're on develop branch
git checkout develop

# Create new project
npx vercel
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → `itmusumbas-projects` (your team)
- **Link to existing project?** → **No** (we want NEW project)
- **Project name?** → `farm2market-dev`
- **Directory?** → `./`

### Step 3: Set Environment Variables via CLI

```bash
# Set Convex URL for all environments
echo "https://adamant-armadillo-601.convex.cloud" | npx vercel env add NEXT_PUBLIC_CONVEX_URL production
echo "https://adamant-armadillo-601.convex.cloud" | npx vercel env add NEXT_PUBLIC_CONVEX_URL preview
echo "https://adamant-armadillo-601.convex.cloud" | npx vercel env add NEXT_PUBLIC_CONVEX_URL development

# Set deployment mode for all environments
echo "dev" | npx vercel env add NEXT_PUBLIC_DEPLOYMENT_MODE production
echo "dev" | npx vercel env add NEXT_PUBLIC_DEPLOYMENT_MODE preview
echo "dev" | npx vercel env add NEXT_PUBLIC_DEPLOYMENT_MODE development
```

### Step 4: Configure Production Branch

Go to Vercel dashboard → `farm2market-dev` project → Settings → Git → Set Production Branch to `develop`

### Step 5: Deploy
```bash
npx vercel --prod
```

---

## Verification

After deployment:

1. **Visit**: Your dev Vercel URL
2. **Open**: Browser console (F12)
3. **Look for**:
   ```
   [DEV] Creating Convex client with URL: https://adamant-armadillo-601.convex.cloud
   [DEV] Convex client created successfully
   ```

---

## Troubleshooting

### "Project already exists"
- The project name `farm2market-dev` might be taken
- Try: `farm2market-dev-v2` or `farm2market-development`

### "Can't find Environment Variables section"
- Look for "Environment Variables" or "Env" in the project settings
- It might be under "Settings" → "Environment Variables"

### "Wrong deployment mode"
- Check environment variables are set correctly
- Redeploy after updating environment variables

---

## Quick Checklist

- [ ] Created new Vercel project: `farm2market-dev`
- [ ] Set Production Branch to: `develop`
- [ ] Added `NEXT_PUBLIC_CONVEX_URL` = `https://adamant-armadillo-601.convex.cloud`
- [ ] Added `NEXT_PUBLIC_DEPLOYMENT_MODE` = `dev`
- [ ] Selected all environments (Production, Preview, Development)
- [ ] Deployed successfully
- [ ] Verified dev mode in browser console

---

## What You'll Have After Setup

**Pilot Project** (existing):
- URL: Your current `farm2market` Vercel URL
- Branch: `main`
- Mode: `pilot`
- Convex: `https://chatty-camel-373.convex.cloud`

**Dev Project** (new):
- URL: `farm2market-dev.vercel.app` (or your custom domain)
- Branch: `develop`
- Mode: `dev`
- Convex: `https://adamant-armadillo-601.convex.cloud`

Both run independently! 🎉
