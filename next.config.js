const path = require('path');



/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    domains: ['lh3.googleusercontent.com'], // external image domains
  },
  eslint: {
    ignoreDuringBuilds: true, // suppress lint errors during Vercel builds
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname); // use '@/components' etc.
    return config;
  },
};

module.exports = nextConfig;
