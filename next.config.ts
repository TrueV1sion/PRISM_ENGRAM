import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@modelcontextprotocol/sdk", "@anthropic-ai/sdk"],
};

export default nextConfig;
