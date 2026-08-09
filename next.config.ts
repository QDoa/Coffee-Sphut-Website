import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
module.exports = {
  allowedDevOrigins: ['192.168.5.26', 'localhost'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tcxenxliwzykhxzhlien.supabase.co',
        port: '',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}
