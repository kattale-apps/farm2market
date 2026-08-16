# Pilot & Dev Mode Deployment Setup

## Overview

This guide explains how to set up **two separate deployments** with separate URLs:
- **Pilot Mode**: Stable deployment that continues running in its current state
- **Dev Mode**: Development deployment where you can build full functionality without affecting pilot

Both deployments can run simultaneously with completely separate:
- Frontend URLs (Vercel)
- Backend deployments (Convex)
- Databases
- Environment variables

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Git Repository                        │
│              (Single source of truth)                    │
└─────────────────────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌───────────────┐
│ Pilot Branch  │              │  Dev Branch   │
│ (main/master) │              │  (develop)    │
└───────────────┘              └───────────────┘
        │                               │
        ▼                               ▼
┌───────────────┐              ┌───────────────┐
│ Vercel Pilot  │              │ Vercel Dev    │
│  Project      │              │  Project      │
│ pilot.yourapp │              │ dev.yourapp   │
└───────────────┘              └───────────────┘
        │                               │
        ▼                               ▼
┌───────────────┐              ┌───────────────┐
│ Convex Pilot  │              │ Convex Dev    │
│  Deployment   │              │  Deployment   │
│ pilot-xxx     │              │ dev-xxx       │
└───────────────┘              └───────────────┘
```

---

## Step 1: Set Up Two Convex Deployments

### Option A: Separate Convex Projects (Recommended)

1. **Create Pilot Convex Deployment** (if not already exists):
   ```bash
   # In your project root
   npx convex dev --project-name pilot-farm2market
   ```
   This will create a new Convex project. Note the deployment URL (e.g., `https://pilot-xxx.convex.cloud`)

2. **Create Dev Convex Deployment**:
   ```bash
   # Create a new Convex project for dev
   npx convex dev --project-name dev-farm2market
   ```
   Note the deployment URL (e.g., `https://dev-xxx.convex.cloud`)

3. **Deploy to Both**:
   ```bash
   # Deploy to pilot (from main branch)
   git checkout main
   npx convex deploy --project-name pilot-farm2market
   
   # Deploy to dev (from dev branch)
   git checkout develop
   npx convex deploy --project-name dev-farm2market
   ```

### Option B: Use Convex Branch Deployments

Convex supports branch-based deployments. You can configure this in your `convex.json`:

```json
{
  "team": "your-team",
  "project": "your-project",
  "prod": {
    "branch": "main"
  },
  "dev": {
    "branch": "develop"
  }
}
```

---

## Step 2: Set Up Two Vercel Projects

### Option A: Separate Vercel Projects (Recommended)

1. **Create Pilot Vercel Project**:
   - Go to Vercel Dashboard
   - Click "Add New Project"
   - Import your repository
   - **Project Name**: `farm2market-pilot`
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Branch**: `main` (or `master`)
   - **Environment Variables**:
     - `NEXT_PUBLIC_CONVEX_URL`: `https://pilot-xxx.convex.cloud`
     - `NEXT_PUBLIC_DEPLOYMENT_MODE`: `pilot`
   - Click "Deploy"

2. **Create Dev Vercel Project**:
   - Go to Vercel Dashboard
   - Click "Add New Project"
   - Import the **same** repository
   - **Project Name**: `farm2market-dev`
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Branch**: `develop` (or create a new branch)
   - **Environment Variables**:
     - `NEXT_PUBLIC_CONVEX_URL`: `https://dev-xxx.convex.cloud`
     - `NEXT_PUBLIC_DEPLOYMENT_MODE`: `dev`
   - Click "Deploy"

3. **Configure Custom Domains** (Optional):
   - **Pilot**: `pilot.farm2market.com` or `pilot.yourapp.com`
   - **Dev**: `dev.farm2market.com` or `dev.yourapp.com`

### Option B: Use Vercel Branch Deployments

You can use a single Vercel project with branch-based deployments:

1. In Vercel project settings, configure:
   - **Production Branch**: `main`
   - **Preview Branches**: `develop`

2. Set environment variables per branch:
   - Production branch: `NEXT_PUBLIC_DEPLOYMENT_MODE=pilot`
   - Preview branch: `NEXT_PUBLIC_DEPLOYMENT_MODE=dev`

---

## Step 3: Configure Environment Variables

### For Pilot Deployment

In Vercel Dashboard → Pilot Project → Settings → Environment Variables:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://pilot-xxx.convex.cloud` | Production, Preview, Development |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `pilot` | Production, Preview, Development |

### For Dev Deployment

In Vercel Dashboard → Dev Project → Settings → Environment Variables:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://dev-xxx.convex.cloud` | Production, Preview, Development |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `dev` | Production, Preview, Development |

---

## Step 4: Git Branch Strategy

### Recommended Workflow

1. **Main/Master Branch** → Pilot Deployment
   - Stable, production-ready code
   - Deploys to pilot URL
   - Only merge when tested and stable

2. **Develop Branch** → Dev Deployment
   - Active development
   - Deploys to dev URL
   - Can break things, experiment freely

3. **Feature Branches** → Dev Deployment (via preview)
   - Individual features
   - Test in dev environment
   - Merge to develop when ready

### Example Workflow

```bash
# Work on new feature in dev
git checkout develop
git pull
git checkout -b feature/new-payment-system

# Make changes, test in dev deployment
# ... code changes ...

# Merge to develop (auto-deploys to dev URL)
git checkout develop
git merge feature/new-payment-system
git push

# When stable, merge to main (deploys to pilot URL)
git checkout main
git merge develop
git push
```

---

## Step 5: Verify Setup

### Check Pilot Deployment

1. Visit pilot URL (e.g., `https://pilot.yourapp.com`)
2. Open browser console
3. Check logs:
   ```
   Creating Convex client with URL: https://pilot-xxx.convex.cloud
   Deployment Mode: pilot
   ```
4. Verify pilot mode features work

### Check Dev Deployment

1. Visit dev URL (e.g., `https://dev.yourapp.com`)
2. Open browser console
3. Check logs:
   ```
   Creating Convex client with URL: https://dev-xxx.convex.cloud
   Deployment Mode: dev
   ```
4. Verify you can make changes without affecting pilot

---

## Step 6: Database Separation

### Important: Separate Databases

Each Convex deployment has its own database:
- **Pilot Convex** → Pilot database (production data)
- **Dev Convex** → Dev database (test data)

**This means:**
- ✅ Changes in dev don't affect pilot data
- ✅ You can test destructive operations in dev
- ✅ Pilot continues with its own data
- ⚠️ Data doesn't sync between deployments

### Seeding Dev Database

To seed the dev database with test data:

```bash
# Switch to dev Convex project
npx convex dev --project-name dev-farm2market

# Run seed scripts (if you have them)
# Or manually create test data through the UI
```

---

## Troubleshooting

### Issue: Both deployments use same Convex URL

**Solution**: Check environment variables in Vercel. Each project must have its own `NEXT_PUBLIC_CONVEX_URL`.

### Issue: Changes in dev affect pilot

**Solution**: Verify you're using separate Convex deployments. Check that `NEXT_PUBLIC_CONVEX_URL` is different for each Vercel project.

### Issue: Can't deploy to both Convex projects

**Solution**: Use `--project-name` flag or configure `convex.json` with multiple projects.

### Issue: Environment variable not updating

**Solution**: 
1. Update environment variable in Vercel
2. **Redeploy** the project (environment variables are injected at build time)

---

## Best Practices

1. **Always test in dev first** before merging to main
2. **Keep pilot stable** - only merge tested, stable code
3. **Use feature flags** for gradual rollouts
4. **Monitor both deployments** separately
5. **Document breaking changes** before deploying to pilot
6. **Keep databases separate** - never sync dev data to pilot

---

## Cost Considerations

- **Vercel**: Two projects = two deployments (may affect free tier limits)
- **Convex**: Two deployments = two separate databases (check pricing)
- **Domains**: Custom domains may have additional costs

---

## Next Steps

1. Set up both Convex deployments
2. Create both Vercel projects
3. Configure environment variables
4. Test both deployments
5. Update CI/CD if you have it
6. Document your specific URLs and project names

---

## Quick Reference

### Pilot Deployment
- **URL**: `https://pilot.yourapp.com`
- **Branch**: `main`
- **Convex**: `https://pilot-xxx.convex.cloud`
- **Mode**: `pilot`

### Dev Deployment
- **URL**: `https://dev.yourapp.com`
- **Branch**: `develop`
- **Convex**: `https://dev-xxx.convex.cloud`
- **Mode**: `dev`
