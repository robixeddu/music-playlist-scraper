import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
