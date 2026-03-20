import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma", "@modelcontextprotocol/sdk", "@anthropic-ai/sdk"],
};

export default nextConfig;
