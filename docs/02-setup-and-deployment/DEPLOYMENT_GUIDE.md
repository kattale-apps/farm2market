# Deployment Guide - Farm2Market Uganda

This guide covers deploying the application to Convex (backend), Vercel (frontend), and GitHub (repository).

## Prerequisites

1. **Convex Account**: Sign up at https://dashboard.convex.dev
2. **Vercel Account**: Sign up at https://vercel.com
3. **GitHub Account**: Sign up at https://github.com
4. **Convex CLI**: `npm install -g convex`
5. **Vercel CLI**: `npm install -g vercel` (optional, can use web dashboard)

## Step 1: GitHub Repository Setup

### 1.1 Initialize Git Repository (if not already done)

```bash
# Check if git is initialized
git status

# If not initialized, run:
git init
```

### 1.2 Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository (e.g., `farm2market-uganda`)
3. **DO NOT** initialize with README, .gitignore, or license (we already have these)

### 1.3 Push Code to GitHub

```bash
# Add all files
git add .

# Commit changes
git commit -m "Initial commit: UX Extensions v1.2 implementation"

# Add remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 1.4 Verify .gitignore

Ensure `.gitignore` includes:
- `.env*` files (except `.env.example`)
- `node_modules/`
- `.next/`
- `convex/_generated/`
- Any sensitive files

## Step 2: Convex Backend Deployment

### 2.1 Install Convex CLI (if not installed)

```bash
npm install -g convex
```

### 2.2 Login to Convex

```bash
npx convex login
```

### 2.3 Initialize Convex Project (if not already done)

```bash
# In project root
npx convex dev
```

This will:
- Create `convex.json` if it doesn't exist
- Generate `convex/_generated/` files
- Set up your Convex deployment

### 2.4 Deploy to Convex Production

```bash
# Deploy to production
npx convex deploy --yes

# Or use the npm script
npm run deploy:pilot
```

### 2.5 Get Convex Deployment URL

After deployment, Convex will provide:
- **Deployment URL**: `https://YOUR_PROJECT.convex.cloud`
- **Dashboard URL**: `https://dashboard.convex.dev`

Save the deployment URL for Vercel configuration.

## Step 3: Vercel Frontend Deployment

### 3.1 Install Vercel CLI (optional)

```bash
npm install -g vercel
```

### 3.2 Deploy via Vercel CLI

```bash
# Login to Vercel
vercel login

# Deploy (first time will ask questions)
vercel

# Deploy to production
vercel --prod
```

### 3.3 Deploy via Vercel Dashboard (Recommended)

1. **Go to https://vercel.com/new**
2. **Import Git Repository**:
   - Connect your GitHub account
   - Select your repository
   - Click "Import"

3. **Configure Project**:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

4. **Environment Variables**:
   Add the following environment variables in Vercel dashboard:
   
   ```
   NEXT_PUBLIC_CONVEX_URL=https://YOUR_PROJECT.convex.cloud
   NEXT_PUBLIC_DEPLOYMENT_MODE=production
   ```

   To add:
   - Go to Project Settings → Environment Variables
   - Add each variable
   - Select environments (Production, Preview, Development)
   - Save

5. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://YOUR_PROJECT.vercel.app`

## Step 4: Post-Deployment Verification

### 4.1 Verify Convex Deployment

1. Go to https://dashboard.convex.dev
2. Check that all tables are created:
   - users, walletLedger, listings, listingUnits, negotiations
   - districts, subcounties, parishes (new)
   - messages, communities, communityMemberships (new)
   - All other tables from schema

3. Test a query:
   - Go to Functions tab
   - Try running `getActiveDistricts` query
   - Verify it returns empty array (no data yet) or existing data

### 4.2 Verify Vercel Deployment

1. Visit your Vercel deployment URL
2. Check that:
   - Page loads without errors
   - Login page appears
   - No console errors in browser DevTools

### 4.3 Verify GitHub Repository

1. Go to your GitHub repository
2. Verify all files are pushed:
   - `convex/` directory
   - `app/` directory
   - `package.json`
   - All other project files

## Step 5: Initial Data Setup (SuperAdmin Required)

After deployment, you'll need to set up initial data:

### 5.1 Create SuperAdmin User

1. Sign up via login page with role "admin"
2. Or use Convex dashboard to create admin user directly

### 5.2 Create Location Hierarchy (via Convex Dashboard or Admin UI)

Run these mutations as SuperAdmin:
- `createDistrict` - Create districts
- `createSubcounty` - Create subcounties (requires district)
- `createParish` - Create parishes (requires subcounty)

### 5.3 Create Storage Locations

Use existing `createStorageLocation` mutation (if available) or admin UI.

### 5.4 Create Produce Options

Use existing `createProduceOption` mutation or admin UI.

### 5.5 Set System Settings

- Set `traderCommissionPercentage` (default: 0)
- Set `storageFeeRateKgPerDay` (default: 0.5)
- Set `buyerServiceFeePercentage` (default: 3)
- Set `pilotMode` to `false` for production

## Step 6: Continuous Deployment Setup

### 6.1 GitHub Actions (Optional)

Create `.github/workflows/deploy.yml` for automated deployments:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
      - name: Deploy to Convex
        run: npx convex deploy --yes
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

### 6.2 Vercel Auto-Deploy

Vercel automatically deploys when you push to GitHub:
- **Production**: Deploys from `main` branch
- **Preview**: Deploys from other branches/PRs

### 6.3 Convex Auto-Deploy

Convex can be configured to auto-deploy:
- Use Convex dashboard → Settings → Deployments
- Enable automatic deployments from GitHub

## Troubleshooting

### Convex Deployment Issues

1. **Schema Push Errors**:
   ```bash
   # Clear and re-push schema
   npx convex deploy --yes --force
   ```

2. **Missing Functions**:
   - Check that all `convex/*.ts` files are committed
   - Verify imports are correct

3. **Environment Variables**:
   - Check `convex.json` for deployment configuration
   - Verify Convex dashboard settings

### Vercel Deployment Issues

1. **Build Failures**:
   - Check build logs in Vercel dashboard
   - Verify `package.json` scripts are correct
   - Check for TypeScript errors: `npm run lint`

2. **Environment Variables**:
   - Verify `NEXT_PUBLIC_CONVEX_URL` is set
   - Check variable names (case-sensitive)
   - Ensure variables are added to correct environments

3. **Runtime Errors**:
   - Check browser console for errors
   - Verify Convex URL is correct
   - Check network tab for failed API calls

### GitHub Issues

1. **Large Files**:
   - Ensure `.gitignore` excludes `node_modules/`, `.next/`, etc.
   - Use Git LFS for large files if needed

2. **Missing Files**:
   - Verify all files are committed: `git status`
   - Check `.gitignore` isn't excluding needed files

## Security Checklist

Before going to production:

- [ ] Remove pilot mode shared password
- [ ] Set up proper authentication
- [ ] Configure CORS in Convex (if needed)
- [ ] Set up environment variables securely
- [ ] Enable Vercel password protection (if needed)
- [ ] Review and restrict Convex API access
- [ ] Set up monitoring and error tracking
- [ ] Configure backup strategy for Convex data
- [ ] Review and update all API keys/secrets
- [ ] Enable HTTPS (automatic on Vercel)

## Production URLs

After deployment, you'll have:

- **Frontend**: `https://YOUR_PROJECT.vercel.app`
- **Convex Dashboard**: `https://dashboard.convex.dev`
- **Convex API**: `https://YOUR_PROJECT.convex.cloud`
- **GitHub**: `https://github.com/YOUR_USERNAME/YOUR_REPO`

## Next Steps

1. **Test all features** in production environment
2. **Set up monitoring** (Vercel Analytics, Convex monitoring)
3. **Configure backups** for Convex data
4. **Set up error tracking** (Sentry, etc.)
5. **Performance optimization** (if needed)
6. **User acceptance testing**

## Support

For issues:
- **Convex**: https://docs.convex.dev
- **Vercel**: https://vercel.com/docs
- **GitHub**: https://docs.github.com
