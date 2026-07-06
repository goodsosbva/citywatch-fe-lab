import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@citywatch/api-types", "@citywatch/ui"],
};

export default nextConfig;
