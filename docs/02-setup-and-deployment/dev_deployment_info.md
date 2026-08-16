# Dev Deployment Information

## Convex Deployment ✅

- **Project Name**: `dev-farm2market`
- **Deployment Name**: `adamant-armadillo-601`
- **Convex URL**: `https://adamant-armadillo-601.convex.cloud`
- **Dashboard**: https://dashboard.convex.dev/d/adamant-armadillo-601
- **Team**: `kattale-global`
- **Type**: Dev Deployment
- **Status**: ✅ Created and Configured

## Pilot Deployment (Existing)

- **Project Name**: `greedy-tortoise-911` (or `chatty-camel-373`)
- **Convex URL**: `https://chatty-camel-373.convex.cloud` (or `https://greedy-tortoise-911.convex.cloud`)
- **Type**: Pilot/Production Deployment
- **Status**: ✅ Active

---

## Environment Variables for Vercel

### Dev Vercel Project

Set these environment variables:

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://adamant-armadillo-601.convex.cloud` | Production, Preview, Development |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `dev` | Production, Preview, Development |

### Pilot Vercel Project

Keep these environment variables:

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://chatty-camel-373.convex.cloud` (or your pilot URL) | Production, Preview, Development |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `pilot` | Production, Preview, Development |

---

## Deployment Commands

### Deploy to Dev
```bash
# Make sure CONVEX_DEPLOYMENT is set to dev
# Or use the dev deployment directly
npx convex deploy
```

### Deploy to Pilot
```bash
# Switch to pilot deployment first
# Or use the pilot deployment directly
npm run deploy:pilot
```

---

## Next Steps

1. ✅ Dev Convex deployment created
2. ⏳ Deploy Convex functions to dev
3. ⏳ Create dev Vercel project
4. ⏳ Configure Vercel environment variables
5. ⏳ Test dev deployment
