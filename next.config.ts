import type { NextConfig } from "next";

/**
 * Security headers (hardening P5). Sem CSP rígida por ora — o app usa estilos
 * inline + scripts próprios (seat-picker/svg-pan-zoom) e uma CSP errada quebraria
 * o site às vésperas do on-sale. HSTS/anti-clickjacking/nosniff são seguros.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
