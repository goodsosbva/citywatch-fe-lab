import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ["@citywatch/api-types", "@citywatch/ui"],
};

export default nextConfig;
