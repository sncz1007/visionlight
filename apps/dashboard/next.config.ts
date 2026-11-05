import type { NextConfig } from "next";

// El panel reenvía /api/* a la API: así la cookie de sesión es del mismo dominio.
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL ?? "http://localhost:4000"}/:path*` }];
  },
};
export default nextConfig;
