import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        headers: [
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
        source: "/:path*",
      },
    ];
  },
  transpilePackages: ["@citywatch/api-types", "@citywatch/ui"],
};

export default nextConfig;
