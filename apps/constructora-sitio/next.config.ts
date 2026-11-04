import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Sitio 100% estático: Cloudflare sirve `out/` como assets, sin ejecutar código.
  output: "export",
  transpilePackages: ["@jurmaq/shared"],
  outputFileTracingRoot: path.resolve(__dirname, "../../"),
  turbopack: { root: path.resolve(__dirname, "../../") },
  images: { unoptimized: true },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
