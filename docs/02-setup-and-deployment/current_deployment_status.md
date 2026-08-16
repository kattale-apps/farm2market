# Current Deployment Status

**Last Updated**: Current setup

## Pilot Deployment ✅ (Active)

- **Status**: ✅ Working
- **Convex URL**: `https://chatty-camel-373.convex.cloud`
- **Deployment Mode**: `pilot` (default)
- **Vercel Project**: Existing project (configured)
- **Branch**: `main`
- **Database**: Pilot database (production data)

**Configuration:**
- Environment variable `NEXT_PUBLIC_CONVEX_URL` should be set to pilot URL
- Environment variable `NEXT_PUBLIC_DEPLOYMENT_MODE` can be set to `pilot` (or omitted, defaults to pilot)

---

## Dev Deployment ✅ (Created)

- **Status**: ✅ Convex deployment created
- **Convex URL**: `https://adamant-armadillo-601.convex.cloud`
- **Deployment Name**: `adamant-armadillo-601`
- **Project Name**: `dev-farm2market`
- **Dashboard**: https://dashboard.convex.dev/d/adamant-armadillo-601
- **Deployment Mode**: `dev`
- **Vercel Project**: ⏳ To be created
- **Branch**: `develop` ✅
- **Database**: Dev database (test data, separate from pilot)

**Next Steps:**
1. ✅ Create dev Convex deployment - DONE
2. ⏳ Deploy Convex functions to dev
3. ⏳ Create dev Vercel project
4. ⏳ Configure Vercel environment variables
5. ⏳ Test deployment

---

## Safety Guarantees

✅ **Pilot deployment is safe:**
- Existing pilot setup continues to work
- Default mode is `pilot` (backward compatible)
- No changes required to existing pilot configuration
- Pilot database remains separate

✅ **Dev deployment is isolated:**
- Separate Convex project
- Separate database
- Separate Vercel project
- Changes in dev don't affect pilot

---

## Quick Commands

### Check Current Mode (in code)
```typescript
import { getDeploymentMode } from "@/app/utils/deployment";
const mode = getDeploymentMode(); // "pilot" | "dev"
```

### Deploy to Pilot
```bash
npm run deploy:pilot
```

### Deploy to Dev
```bash
npm run deploy:dev
```

---

## Documentation

- **Setup Guide**: `docs/setup_dev_mode.md` - Step-by-step guide to create dev mode
- **Architecture**: `docs/deployment_modes_setup.md` - Complete architecture overview
- **Quick Reference**: `docs/deployment_modes_quick_reference.md` - Quick commands and reference
- **Environment Variables**: `docs/env-examples.md` - Environment variable examples
