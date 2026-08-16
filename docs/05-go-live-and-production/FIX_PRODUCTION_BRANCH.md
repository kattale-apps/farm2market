# Fix: Production Branch Not Found

## Problem
Vercel says "branch develop not found in git Repository" when trying to set production branch.

## Solution ✅

The `develop` branch has been pushed to GitHub. Follow these steps:

### Step 1: Refresh Vercel
1. Go to: https://vercel.com/itmusumbas-projects/farm2market-dev/settings/git
2. **Wait 10-30 seconds** for Vercel to sync with GitHub
3. **Click "Refresh"** button if available

### Step 2: Set Production Branch
1. Find **"Production Branch"** dropdown
2. Select **`develop`** from the list
3. Click **"Save"**

### Step 3: Verify
- The production branch should now show as `develop`
- Future deployments from `develop` branch will go to production

---

## If Branch Still Doesn't Appear

### Option 1: Disconnect and Reconnect Git
1. In Vercel project settings → Git
2. Click **"Disconnect"** repository
3. Click **"Connect Git Repository"**
4. Select your repository again
5. Vercel will re-scan all branches

### Option 2: Check GitHub
Verify the branch exists on GitHub:
- Go to: https://github.com/ITMusumba/my-app/branches
- You should see `develop` branch listed

### Option 3: Manual Trigger
1. Make a small change on `develop` branch
2. Push to GitHub: `git push origin develop`
3. This triggers a webhook that Vercel will receive

---

## Verification

After setting production branch:
- Push to `develop` → Deploys to dev production
- Push to `main` → Deploys to pilot production (unchanged)

---

## Current Status

✅ `develop` branch pushed to GitHub
✅ Branch available at: https://github.com/ITMusumba/my-app/tree/develop
⏳ Waiting for Vercel to sync (usually 10-30 seconds)
