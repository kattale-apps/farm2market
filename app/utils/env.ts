/**
 * Distinguishes the public production deployment (the `main` branch, built
 * with Vercel's automatic VERCEL_ENV="production") from every other
 * deployment — the `develop` branch preview and local dev — where
 * in-progress roles/features should stay fully usable for continued work.
 * Wired through next.config.js as NEXT_PUBLIC_APP_IS_PROD so it's available
 * client-side without any manual Vercel dashboard configuration.
 */
export const IS_PRODUCTION_DEPLOYMENT = process.env.NEXT_PUBLIC_APP_IS_PROD === "true";
