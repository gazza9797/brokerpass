import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Turbopack scoped to this folder even if a stray package-lock
    // exists higher up on the developer's machine.
    root: path.resolve(__dirname),
  },
  experimental: {
    serverActions: {
      // Deal packages are PDFs; allow up to 25 MB per upload.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
