import type { NextConfig } from "next";

const defaultApiBase = "http://localhost:5050/api/v1";

function apiOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || defaultApiBase);
  } catch {
    return new URL(defaultApiBase);
  }
}

const backend = apiOrigin();
const backendProtocol = backend.protocol.replace(":", "") as "http" | "https";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: {
    position: "bottom-right",
  },
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: backendProtocol,
        hostname: backend.hostname,
        port: backend.port,
        pathname: "/uploads/**",
      },
      {
        protocol: backendProtocol,
        hostname: backend.hostname,
        port: backend.port,
        pathname: "/api/v1/uploads/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
