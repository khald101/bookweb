import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'jszip', 'tesseract.js'],
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '192.168.1.43',
    '*.trycloudflare.com',
    '*.loca.lt',
  ],
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: ['**/data/**', '**/.data/**', '**/public/uploads/**', '**/*.log'],
      };
    }
    return config;
  },
};

export default nextConfig;
