# Dev Deployment Setup Status

## ✅ Completed

1. **Dev Convex Deployment Created**
   - Project: `dev-farm2market`
   - Deployment: `adamant-armadillo-601`
   - URL: `https://adamant-armadillo-601.convex.cloud`
   - Dashboard: https://dashboard.convex.dev/d/adamant-armadillo-601
   - Status: ✅ Ready

2. **Develop Branch Created**
   - Branch: `develop`
   - Status: ✅ Ready for development

3. **Code Support**
   - Deployment mode detection: ✅
   - Environment variable support: ✅
   - Deployment scripts: ✅

---

## ⏳ Next Steps

### Step 1: Deploy Convex Functions to Dev (Optional - Can do later)

When you're ready to deploy functions to the dev deployment:

```bash
# Make sure you're authenticated
npx convex dev

# Then deploy (this will use the dev deployment from .env.local)
npx convex deploy --env-file .env.local --yes
```

Or you can deploy functions later through the Convex dashboard.

### Step 2: Create Dev Vercel Project (Required)

1. **Go to**: https://vercel.com/dashboard
2. **Click**: "Add New Project"
3. **Import**: Your repository (same as pilot)
4. **Configure**:
   - **Project Name**: `farm2market-dev`
   - **Framework**: Next.js (auto-detected)
   - **Root Directory**: `./`
   - **Production Branch**: `develop` ⚠️ **IMPORTANT!**

5. **Set Environment Variables** (BEFORE deploying):
   - Click "Environment Variables" section
   - Add:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `NEXT_PUBLIC_CONVEX_URL` | `https://adamant-armadillo-601.convex.cloud` | ✅ All |
   | `NEXT_PUBLIC_DEPLOYMENT_MODE` | `dev` | ✅ All |

6. **Click**: "Deploy"

### Step 3: Verify Dev Deployment

1. Visit your dev Vercel URL
2. Open browser console (F12)
3. Look for:
   ```
   [DEV] Creating Convex client with URL: https://adamant-armadillo-601.convex.cloud
   [DEV] Convex client created successfully
   ```

---

## 📋 Environment Variables Summary

### Dev Vercel Project
```
NEXT_PUBLIC_CONVEX_URL=https://adamant-armadillo-601.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=dev
```

### Pilot Vercel Project (Keep as is)
```
NEXT_PUBLIC_CONVEX_URL=https://chatty-camel-373.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=pilot
```

---

## 🚀 Ready to Develop!

Once Vercel is set up:
- Work on `develop` branch
- Changes auto-deploy to dev URL
- Test features in dev
- Merge to `main` when ready for pilot

---

## Quick Commands

```bash
# Switch to develop branch
git checkout develop

# Deploy Convex functions to dev (when needed)
npx convex deploy --env-file .env.local --yes

# Check deployment mode in code
import { getDeploymentMode } from "@/app/utils/deployment";
const mode = getDeploymentMode(); // "dev" when in dev mode
```
