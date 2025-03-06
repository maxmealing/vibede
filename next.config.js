/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.externals.push({
      '@tauri-apps/api': 'commonjs @tauri-apps/api',
    });
    return {
      ...config,
      resolve: {
        ...config.resolve,
        fallback: {
          ...config.resolve.fallback,
          fs: false,
          path: false,
          os: false,
        },
      },
    };
  },
};

module.exports = nextConfig; 