import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Turbopack scoped to this folder even if a stray package-lock
    // exists higher up on the developer's machine.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
