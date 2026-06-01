import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  devIndicators: {
    position: "bottom-right", // top-right, bottom-right, top-left, bottom-left
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "5050",
        pathname: "/uploads/**",
      }, // other external image sources
      {
        protocol: "https",
        hostname: "unsplash.com",
      }
    ]
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  }
};

export default nextConfig;
