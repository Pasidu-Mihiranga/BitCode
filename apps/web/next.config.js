/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // Standalone is for Docker; Vercel uses its own Next.js output.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
  async rewrites() {
    const apiBase =
      process.env.API_PROXY_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      (process.env.VERCEL ? null : "http://api1:3000");
    if (!apiBase) return [];
    const base = apiBase.replace(/\/$/, "");
    return [
      { source: "/api/:path*", destination: `${base}/api/:path*` },
      { source: "/ws/:path*", destination: `${base.replace(/^http/, "ws")}/ws/:path*` },
    ];
  },
  experimental: { typedRoutes: false },
};
