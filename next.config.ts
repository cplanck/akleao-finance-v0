import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone', // Enable for Docker deployment
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatar.vercel.sh',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
