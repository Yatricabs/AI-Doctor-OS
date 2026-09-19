/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native module. Keep it external so Next.js does not try to
  // bundle the compiled binary, which breaks it on serverless (Vercel) runtimes.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  // Landing-page imagery is served from Unsplash. Allow next/image to optimize it.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
