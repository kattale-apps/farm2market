# Quick Start: Create Dev Deployment

## Step 1: Create Dev Convex Deployment (Interactive)

Run this command in your terminal:

```bash
npx convex dev --configure new
```

**When prompted:**
1. **Log in** to Convex (if not already logged in)
2. **Choose or create a team** (use your existing team)
3. **Project name**: Enter `dev-farm2market`
4. **Deployment type**: Choose `Cloud` (not local)

**After it completes:**
- Look for a line like: `NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud`
- **Copy this URL** - you'll need it for Step 2

**Then deploy your functions:**
```bash
npx convex deploy
```

---

## Step 2: Create Dev Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New Project"**
3. **Import your repository** (same repo as pilot)
4. **Configure:**
   - Project Name: `farm2market-dev`
   - Framework: Next.js (auto-detected)
   - Root Directory: `./`
   - **Production Branch**: `develop` (important!)

5. **Before deploying, set Environment Variables:**
   - Click "Environment Variables" section
   - Add:
     - `NEXT_PUBLIC_CONVEX_URL` = `https://xxx.convex.cloud` (from Step 1)
     - `NEXT_PUBLIC_DEPLOYMENT_MODE` = `dev`
   - Select all environments (Production, Preview, Development)

6. Click **"Deploy"**

---

## Step 3: Verify

1. Visit your dev Vercel URL
2. Open browser console (F12)
3. Look for:
   ```
   [DEV] Creating Convex client with URL: https://xxx.convex.cloud
   [DEV] Convex client created successfully
   ```

---

## Alternative: Use Helper Script

**Windows (PowerShell):**
```powershell
.\scripts\create-dev-deployment.ps1
```

**Mac/Linux:**
```bash
chmod +x scripts/create-dev-deployment.sh
./scripts/create-dev-deployment.sh
```

---

## What's Next?

Once dev is set up:
- Work on `develop` branch for dev features
- Merge to `main` when ready for pilot
- Dev and pilot run independently!
