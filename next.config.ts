import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-only: allow opening the dev server from other devices on the LAN.
  // Next.js 16 blocks dev resources (HMR websocket) for non-localhost hosts,
  // which prevents client-side hydration entirely. Has no effect in production.
  allowedDevOrigins: ["192.168.5.48"],
  images: {
    dangerouslyAllowLocalIP: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "tcxenxliwzykhxzhlien.supabase.co",
        port: "",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
