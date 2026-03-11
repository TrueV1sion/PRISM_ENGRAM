import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  // Prevent Next.js from reloading when Prisma DB and pipeline output changes
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;
