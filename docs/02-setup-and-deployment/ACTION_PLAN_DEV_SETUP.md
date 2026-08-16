# Action Plan: Create Dev Deployment

## Current Status ✅

- ✅ Code supports both modes (pilot & dev)
- ✅ `develop` branch created
- ✅ Deployment scripts ready
- ⏳ **NEXT**: Create dev Convex deployment (interactive step)

---

## Step 1: Create Dev Convex Deployment ⏳

**Run this command in your terminal:**

```bash
npx convex dev --configure new
```

**Interactive Prompts - Answer as follows:**

1. **"Log in to Convex?"** → Yes (or you're already logged in)
2. **"Choose a team"** → Select your existing team
3. **"Project name:"** → Enter: `dev-farm2market`
4. **"Deployment type:"** → Choose: `Cloud` (not local)

**After completion, you'll see:**
```
✅ Configured Convex project: dev-farm2market
NEXT_PUBLIC_CONVEX_URL=https://xxx-yyy-zzz.convex.cloud
```

**📝 IMPORTANT: Copy the Convex URL!** You'll need it for Step 2.

**Then deploy your functions:**
```bash
npx convex deploy
```

---

## Step 2: Create Dev Vercel Project ⏳

1. **Go to**: https://vercel.com/dashboard
2. **Click**: "Add New Project"
3. **Import**: Your repository (same as pilot)
4. **Configure**:
   - **Project Name**: `farm2market-dev`
   - **Framework**: Next.js (auto-detected)
   - **Root Directory**: `./`
   - **Production Branch**: `develop` ⚠️ **IMPORTANT!**

5. **Before clicking Deploy, set Environment Variables:**
   - Click "Environment Variables" section
   - Add these two variables:

   | Name | Value | Environments |
   |------|-------|--------------|
   | `NEXT_PUBLIC_CONVEX_URL` | `https://xxx-yyy-zzz.convex.cloud` (from Step 1) | ✅ Production<br>✅ Preview<br>✅ Development |
   | `NEXT_PUBLIC_DEPLOYMENT_MODE` | `dev` | ✅ Production<br>✅ Preview<br>✅ Development |

6. **Click**: "Deploy"

---

## Step 3: Verify Dev Deployment ✅

1. **Visit**: Your dev Vercel URL (shown after deployment)
2. **Open**: Browser console (F12)
3. **Check for**:
   ```
   [DEV] Creating Convex client with URL: https://xxx-yyy-zzz.convex.cloud
   [DEV] Convex client created successfully
   [DEV] Rendering with ConvexProvider
   ```

4. **Verify**: Dashboard shows "Connected" status

---

## Step 4: Start Developing! 🚀

Now you can:

1. **Work on `develop` branch:**
   ```bash
   git checkout develop
   # Make your changes
   git add .
   git commit -m "Add new feature"
   git push  # Auto-deploys to dev URL
   ```

2. **Deploy Convex functions to dev:**
   ```bash
   npm run deploy:dev
   ```

3. **When ready for pilot:**
   ```bash
   git checkout main
   git merge develop
   git push  # Auto-deploys to pilot URL
   npm run deploy:pilot
   ```

---

## Troubleshooting

### "Project name already exists"
- Try a different name: `dev-farm2market-v2` or `farm2market-dev`

### "Can't find Convex URL"
- Check the output of `npx convex dev --configure new`
- Look for line starting with `NEXT_PUBLIC_CONVEX_URL=`
- Or check Convex dashboard: https://dashboard.convex.dev

### "Dev deployment uses pilot URL"
- Check Vercel environment variables
- Make sure `NEXT_PUBLIC_CONVEX_URL` is set to dev URL
- Redeploy after updating environment variables

---

## Quick Commands Reference

```bash
# Deploy to dev Convex
npm run deploy:dev

# Deploy to pilot Convex
npm run deploy:pilot

# Check current branch
git branch --show-current

# Switch to develop
git checkout develop

# Switch to main
git checkout main
```

---

## What's Next After Setup?

Once dev is working:
- ✅ Develop features in `develop` branch
- ✅ Test in dev deployment
- ✅ Merge to `main` when stable
- ✅ Pilot continues running independently

**You're ready to start!** 🎉
