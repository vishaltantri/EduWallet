import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL("https://api.qrserver.com/v1/**")],
  },
};

export default nextConfig;
