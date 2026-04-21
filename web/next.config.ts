import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/tidal-api/:path*",
        destination: "https://openapi.tidal.com/v2/:path*",
      },
      {
        source: "/tidal-user-api/:path*",
        destination: "https://api.tidal.com/v2/:path*",
      },
    ];
  },
};

export default nextConfig;
