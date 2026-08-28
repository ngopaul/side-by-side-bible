import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/bible/chapter": ["./data/original/**/*.json"],
  },
};

export default nextConfig;
