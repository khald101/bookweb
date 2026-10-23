import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'jszip', 'tesseract.js'],
};

export default nextConfig;
