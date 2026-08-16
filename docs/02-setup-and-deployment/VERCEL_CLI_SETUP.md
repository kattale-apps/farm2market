# Vercel CLI Setup for Dev Project

## Using Vercel CLI to Create Dev Project

Since you're having trouble with the web interface, we can use the Vercel CLI to set up the dev project.

### Step 1: Login to Vercel (if needed)

```bash
npx vercel login
```

### Step 2: Link to Existing Project or Create New

We'll create a new project for dev mode. The existing `farm2market` project will remain as pilot.

### Step 3: Create Dev Project

```bash
# Make sure you're on develop branch
git checkout develop

# Link/create dev project
npx vercel --yes
```

When prompted:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your team/account
- **Link to existing project?** → No (we want a new project)
- **Project name?** → `farm2market-dev`
- **Directory?** → `./` (current directory)

### Step 4: Set Environment Variables

After project is created, set environment variables:

```bash
# Set Convex URL for dev
npx vercel env add NEXT_PUBLIC_CONVEX_URL production
# When prompted, enter: https://adamant-armadillo-601.convex.cloud

npx vercel env add NEXT_PUBLIC_CONVEX_URL preview
# When prompted, enter: https://adamant-armadillo-601.convex.cloud

npx vercel env add NEXT_PUBLIC_CONVEX_URL development
# When prompted, enter: https://adamant-armadillo-601.convex.cloud

# Set deployment mode
npx vercel env add NEXT_PUBLIC_DEPLOYMENT_MODE production
# When prompted, enter: dev

npx vercel env add NEXT_PUBLIC_DEPLOYMENT_MODE preview
# When prompted, enter: dev

npx vercel env add NEXT_PUBLIC_DEPLOYMENT_MODE development
# When prompted, enter: dev
```

### Step 5: Configure Production Branch

In Vercel dashboard:
1. Go to your new `farm2market-dev` project
2. Settings → Git
3. Set **Production Branch** to: `develop`

### Step 6: Deploy

```bash
npx vercel --prod
```

Or push to `develop` branch and it will auto-deploy.

---

## Alternative: Use Vercel Dashboard

If you prefer the web interface:

1. Go to: https://vercel.com/dashboard
2. Click "Add New Project"
3. Import your repository
4. **Project Name**: `farm2market-dev`
5. **Production Branch**: `develop`
6. **Environment Variables** (before deploying):
   - `NEXT_PUBLIC_CONVEX_URL` = `https://adamant-armadillo-601.convex.cloud`
   - `NEXT_PUBLIC_DEPLOYMENT_MODE` = `dev`
7. Deploy
