import { federation } from "@module-federation/vite";
import { defineConfig } from "vite";

const origin = "http://127.0.0.1:3002";

export default defineConfig({
  base: `${origin}/`,
  build: {
    target: "es2022",
  },
  plugins: [
    federation({
      dts: false,
      exposes: {
        "./analytics-metrics": "./src/analytics-metrics.tsx",
      },
      filename: "remoteEntry.js",
      manifest: true,
      name: "citywatch_analytics",
      shared: {
        react: {
          singleton: true,
        },
      },
    }),
  ],
  preview: {
    cors: true,
    host: "127.0.0.1",
    port: 3002,
    strictPort: true,
  },
  server: {
    cors: true,
    host: "127.0.0.1",
    origin,
    port: 3002,
    strictPort: true,
  },
});
