import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';
const internalHost = process.env.TAURI_DEV_HOST || 'localhost';

const nextConfig: NextConfig = {
  // Ensure Next.js uses SSG instead of SSR for Tauri compatibility
  output: 'export',
  
  // Required for Next.js Image component in SSG mode
  images: {
    unoptimized: true,
  },
  
  // Configure asset prefix for development
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
};

export default nextConfig;
