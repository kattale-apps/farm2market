const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
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
