# Deployment Modes - Quick Reference

## Overview

Two separate deployments with separate URLs:
- **Pilot**: Stable, production-ready (`pilot.yourapp.com`)
- **Dev**: Active development (`dev.yourapp.com`)

---

## Environment Variables

### Pilot Deployment
```bash
NEXT_PUBLIC_CONVEX_URL=https://pilot-xxx.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=pilot
```

### Dev Deployment
```bash
NEXT_PUBLIC_CONVEX_URL=https://dev-xxx.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=dev
```

---

## Git Workflow

```bash
# Work on dev
git checkout develop
# ... make changes ...
git push  # Auto-deploys to dev URL

# When stable, merge to pilot
git checkout main
git merge develop
git push  # Auto-deploys to pilot URL
```

---

## Convex Deployments

Two deployments, and the npm script names match what they actually do:

| Target | Deployment | Command |
|---|---|---|
| Dev | `adamant-armadillo-601` | `npm run deploy:dev` |
| Production | `greedy-tortoise-911` | `npm run deploy:prod` |

### Deploy to Dev
```bash
git checkout develop
npm run deploy:dev    # npx convex dev --once
```

`convex deploy` cannot target a dev deployment — it always writes to the
project's production deployment. Pushing to dev therefore uses
`convex dev --once`, which is what `deploy:dev` runs.

### Deploy to Production
```bash
git checkout main
npm run deploy:prod   # npx convex deploy --env-file .env.local --yes
```

Confirm any target before a real deploy:
```bash
npx convex deploy --env-file .env.local --dry-run --yes
```
It prints the deployment URL it would write to and changes nothing.

---

## Vercel Projects

1. **Pilot Project**
   - Branch: `main`
   - URL: `pilot.yourapp.com`
   - Environment: `NEXT_PUBLIC_DEPLOYMENT_MODE=pilot`

2. **Dev Project**
   - Branch: `develop`
   - URL: `dev.yourapp.com`
   - Environment: `NEXT_PUBLIC_DEPLOYMENT_MODE=dev`

---

## Code Usage

### Check Deployment Mode
```typescript
import { getDeploymentMode, isPilotMode, isDevMode } from "@/app/utils/deployment";

const mode = getDeploymentMode(); // "pilot" | "dev"
const isPilot = isPilotMode(); // boolean
const isDev = isDevMode(); // boolean
```

### Conditional Logic
```typescript
if (isDevMode()) {
  // Dev-only features
  console.log("Running in dev mode");
}

if (isPilotMode()) {
  // Pilot-only features
  console.log("Running in pilot mode");
}
```

---

## Important Notes

⚠️ **Separate Databases**: Each Convex deployment has its own database
- Changes in dev don't affect pilot data
- Data doesn't sync between deployments

⚠️ **Separate URLs**: Each deployment has its own frontend URL
- Pilot: `pilot.yourapp.com`
- Dev: `dev.yourapp.com`

⚠️ **Environment Variables**: Must be set in Vercel for each project
- Update in Vercel Dashboard → Settings → Environment Variables
- Redeploy after updating environment variables

---

## Troubleshooting

**Both deployments use same Convex URL?**
→ Check environment variables in Vercel. Each project needs its own `NEXT_PUBLIC_CONVEX_URL`.

**Changes in dev affect pilot?**
→ Verify separate Convex deployments. Check `NEXT_PUBLIC_CONVEX_URL` is different for each project.

**Environment variable not updating?**
→ Update in Vercel, then **redeploy** (environment variables are injected at build time).

---

## Full Documentation

See `docs/deployment_modes_setup.md` for complete setup instructions.
