import type { NextConfig } from "next";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Validate env at build time
jiti("./src/env.ts");

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, packaged by deploy/pi/build-bundle.sh
  output: "standalone",
};

export default nextConfig;
