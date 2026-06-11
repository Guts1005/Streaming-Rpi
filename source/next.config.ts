import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Allow accessing the dev server from network IPs to prevent HMR blocking
  allowedDevOrigins: ['192.168.0.215', 'localhost'],
};

export default nextConfig;
