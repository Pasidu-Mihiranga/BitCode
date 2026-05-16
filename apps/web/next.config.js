/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://api1:3000/api/:path*" },
      { source: "/ws/:path*", destination: "http://api1:3000/ws/:path*" },
      { source: "/uploads/:path*", destination: "/uploads/:path*" },
    ];
  },
  experimental: { typedRoutes: false },
};
