import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // The repo root also has a package-lock.json (the contracts project); the app's root is this folder.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
