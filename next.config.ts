import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The workbook is read from disk with `fs` on the server, so keep xlsx out of the bundle.
  serverExternalPackages: ["xlsx"],
  reactStrictMode: true,
};

export default nextConfig;
