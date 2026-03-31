import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/tidal-api/:path*",
        destination: "https://openapi.tidal.com/v2/:path*",
      },
    ];
  },
};

export default nextConfig;
