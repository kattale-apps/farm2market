const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Let a newly-activated service worker take control of already-open
  // pages immediately, and use next-pwa's default runtime caching (which
  // fetches pages/data NetworkFirst, only falling back to cache when
  // offline) instead of the plugin's own bare-bones default — this
  // shrinks the window where an installed app/PWA can be left running a
  // stale cached page shell after a new deploy.
  clientsClaim: true,
  runtimeCaching: require('next-pwa/cache'),
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    // Vercel sets VERCEL_ENV automatically ("production" for the main
    // branch, "preview" for develop and other branches, unset locally) —
    // surface it to the client so in-progress roles/features can stay
    // active on the develop preview while being locked on production.
    NEXT_PUBLIC_APP_IS_PROD: process.env.VERCEL_ENV === 'production' ? 'true' : 'false',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'adamant-armadillo-601.convex.cloud',
      },
    ],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /convex\/_generated\/.*\.js$/,
      type: 'javascript/auto',
    });
    return config;
  },
}

module.exports = withPWA(nextConfig)
