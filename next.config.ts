import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/mazellist-8d01f0e1/:path*",
        destination: "/mazellist/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
