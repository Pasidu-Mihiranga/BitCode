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
    // WebSockets use NEXT_PUBLIC_WS_BASE_URL in the browser (no http→ws rewrite).
    return [{ source: "/api/:path*", destination: `${base}/api/:path*` }];
  },
  experimental: { typedRoutes: false },
};
