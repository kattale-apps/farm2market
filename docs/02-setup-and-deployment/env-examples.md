# Environment Variable Examples

## Pilot Mode (.env.local for pilot)

Create `.env.local` in your project root with:

```bash
# Pilot Deployment Environment Variables
NEXT_PUBLIC_CONVEX_URL=https://chatty-camel-373.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=pilot
```

## Dev Mode (.env.local for dev)

Create `.env.local` in your project root with:

```bash
# Dev Deployment Environment Variables
# Replace with your dev Convex URL after creating it
NEXT_PUBLIC_CONVEX_URL=https://dev-xxx.convex.cloud
NEXT_PUBLIC_DEPLOYMENT_MODE=dev
```

## Vercel Environment Variables

### Pilot Vercel Project

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://chatty-camel-373.convex.cloud` | Production, Preview, Development |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `pilot` | Production, Preview, Development |

### Dev Vercel Project

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_CONVEX_URL` | `https://dev-xxx.convex.cloud` | Production, Preview, Development |
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `dev` | Production, Preview, Development |

**Note**: Replace `https://dev-xxx.convex.cloud` with your actual dev Convex URL after creating the dev deployment.
