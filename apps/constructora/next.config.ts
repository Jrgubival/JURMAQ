/**
 * PERFORMANCE AUDIT - 2026-04-12
 * ================================
 * Fixes applied for Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1):
 *
 * 1. next.config.ts: Added images.minimumCacheTTL: 60 for aggressive image caching.
 *    Unsplash remotePatterns and AVIF/WebP formats were already present.
 * 2. Root layout: Added <link rel="preconnect"> for Supabase origin.
 * 3. Font loading: Inter already uses display: 'swap' - verified OK.
 * 4. HeroSlideshow: First image uses loading="eager" + fetchPriority="high";
 *    remaining images use loading="lazy" + decoding="async". Added width/height.
 * 5. globals.css: Added .content-auto utility (content-visibility: auto)
 *    for below-fold sections to speed up initial paint.
 * 6. Barraca layout: CartDrawer and NewsletterPopup already use
 *    dynamic(() => import(...), { ssr: false }) - verified OK.
 * 7. Supabase queries: Added .limit(3) to maquinarias query on homepage
 *    that was previously fetching ALL rows then slicing in JS.
 * 8. ProductCard & category images: Added explicit width/height and
 *    decoding="async" to prevent CLS.
 * 9. Below-fold sections on homepage and barraca page use .content-auto
 *    class for deferred rendering.
 */
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['bcryptjs', 'xlsx'],
  transpilePackages: ['@jurmaq/shared'],
  outputFileTracingRoot: path.resolve(__dirname, '../../'),
  turbopack: {
    root: path.resolve(__dirname, '../../'),
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Subdomain rewrite handled by middleware.ts
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://wmoizhbdalvnveclenvf.supabase.co https://api.mercadopago.com",
              // Allow same-origin iframes so admin can embed contract preview.
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // strict-origin (not strict-origin-when-cross-origin): we never want
          // the full URL leaking via Referer to third parties. Tokens of
          // signing flows (firma_token), guest cotization IDs and session
          // UUIDs sometimes live in URLs and would otherwise be exposed
          // when the user clicks a link to MercadoPago, a Supabase storage
          // signed URL, or any external page.
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Download-Options", value: "noopen" },
        ],
      },
    ];
  },
};

export default nextConfig;
