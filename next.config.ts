import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  // Ensure serverless/Netlify runtime can resolve Prisma engines
  serverExternalPackages: ["@prisma/client", "prisma", "cloudinary"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com"
      }
    ]
  }
};

export default nextConfig;
