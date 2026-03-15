import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow server-side packages that use Node.js APIs
  serverExternalPackages: ["puppeteer-core"],
  experimental: {
    // Server Actions are stable in Next.js 15 but we declare this for clarity
  },
};

export default nextConfig;
