import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // LLM outputs are read from llm-cache/ at runtime (demo mode); make sure they ship with the API routes.
  outputFileTracingIncludes: {
    "/api/**": ["./llm-cache/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
