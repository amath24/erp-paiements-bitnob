import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Limit concurrency to keep memory usage lightweight on dev machines
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
