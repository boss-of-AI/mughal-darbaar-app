import { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image optimization — serve from Cloudflare R2
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      // Add your custom R2 domain here after setup:
      // { protocol: "https", hostname: "images.mughaldarbaar.in" }
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // 24 hours
  },

  // Server Actions
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },

  // Logging in development
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
