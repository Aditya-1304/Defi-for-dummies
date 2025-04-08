import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error'],
    } : undefined,
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      '@solana/web3.js', 
      '@coral-xyz/anchor', 
      '@solana/spl-token',
      'framer-motion',
    ],
  },
};

export default nextConfig;
