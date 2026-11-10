import type { NextConfig } from "next";

const devHost = process.env.TAURI_DEV_HOST;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  assetPrefix: devHost ? `http://${devHost}:3000` : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
