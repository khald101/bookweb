import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'jszip', 'tesseract.js'],
  allowedDevOrigins: ['192.168.1.43', '*.trycloudflare.com', '*.loca.lt'],
};

export default nextConfig;
