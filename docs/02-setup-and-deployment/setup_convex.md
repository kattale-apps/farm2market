# Convex Setup Guide

## Deployment Modes

This project supports two deployment modes:
- **Pilot Mode**: Stable deployment (`https://chatty-camel-373.convex.cloud`)
- **Dev Mode**: Development deployment (separate Convex project)

See `docs/setup_dev_mode.md` for setting up dev mode.

## Environment Variables

### For Local Development (Pilot Mode)

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_CONVEX_URL=https://chatty-camel-373.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=pilot
```

**Note**: If `NEXT_PUBLIC_DEPLOYMENT_MODE` is not set, it defaults to `pilot` for backward compatibility.

### For Local Development (Dev Mode)

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_CONVEX_URL=https://dev-xxx.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=dev
```

**Note**: Replace `https://dev-xxx.convex.cloud` with your actual dev Convex URL.

### For Vercel Deployment (Pilot)

1. Go to your **Pilot** Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add variables:
   - **Name**: `NEXT_PUBLIC_CONVEX_URL`
     - **Value**: `https://chatty-camel-373.convex.cloud`
     - **Environment**: Production, Preview, Development (select all)
   - **Name**: `NEXT_PUBLIC_DEPLOYMENT_MODE`
     - **Value**: `pilot`
     - **Environment**: Production, Preview, Development (select all)
4. Click **Save**
5. Redeploy your application (or it will auto-deploy on next push)

### For Vercel Deployment (Dev)

1. Go to your **Dev** Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add variables:
   - **Name**: `NEXT_PUBLIC_CONVEX_URL`
     - **Value**: `https://dev-xxx.convex.cloud` (your dev Convex URL)
     - **Environment**: Production, Preview, Development (select all)
   - **Name**: `NEXT_PUBLIC_DEPLOYMENT_MODE`
     - **Value**: `dev`
     - **Environment**: Production, Preview, Development (select all)
4. Click **Save**
5. Redeploy your application (or it will auto-deploy on next push)

## Deploy Convex Functions

After setting the environment variable, you need to deploy your Convex functions to regenerate the API:

### Deploy to Pilot

```bash
npm run deploy:pilot
# or
npx convex deploy --project-name pilot-farm2market
```

### Deploy to Dev

```bash
npm run deploy:dev
# or
npx convex deploy --project-name dev-farm2market
```

### Deploy to Default (Current Project)

```bash
npx convex deploy
```

**What this does:**
- Deploys all Convex functions to your deployment
- Regenerates `convex/_generated/api.d.ts` with all available modules
- Makes the `pilotMode` and other modules available to the frontend

## Verify Connection

Once both are set up:

1. The dashboard should show "Connected" status
2. Pilot mode status should display real-time data
3. No warning messages about missing Convex URL

## Troubleshooting

### "Convex connection not configured" warning
- Check that `NEXT_PUBLIC_CONVEX_URL` is set in Vercel
- Verify the URL is correct (should end with `.convex.cloud`)
- Redeploy after adding the environment variable

### "API module not found" errors
- Run `npx convex deploy` to regenerate the API
- Check that all Convex functions are exported correctly
- Verify the deployment URL matches your environment variable
