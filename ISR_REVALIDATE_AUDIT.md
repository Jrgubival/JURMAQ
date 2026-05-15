# ISR Revalidate Audit — JURMAQ.CL

**Date:** 2026-05-15
**Scope:** All Next.js pages and API routes with `revalidate` configuration.

## Findings

| File | Type | Revalidate | Context | Risk |
|------|------|-----------|---------|------|
| `apps/barraca/src/app/page.tsx` | Page | 3600s (1h) | Home page with product listings, prices | LOW — homepage is informational, 1h stale prices acceptable |
| `apps/barraca/src/app/api/imagenes/search/route.ts` | API | 3600s (1h) | Image search results | LOW — images are static assets |

## Price-Related Pages Analysis

### Pages with revalidate > 600s

1. **`apps/barraca/src/app/page.tsx`** — `revalidate = 3600`
   - Displays product prices, promotions, and stock
   - **Recommendation:** Reduce to 300s (5 min) for price accuracy, or keep 3600s if price changes are infrequent and communicated via other channels
   - **Impact:** Users may see stale prices for up to 1 hour

### Pages without explicit revalidate

Most pages in both apps do not set `revalidate`, meaning they use the default behavior (static at build time for SSG, or no caching for SSR). These include:
- `apps/barraca/src/app/producto/[slug]/page.tsx` — no revalidate set (SSR, always fresh)
- `apps/barraca/src/app/categorias/[slug]/page.tsx` — no revalidate set
- `apps/constructora/src/app/arriendo/[slug]/page.tsx` — no revalidate set

## Recommendations

1. **`apps/barraca/src/app/page.tsx`**: Consider reducing `revalidate` from 3600 to 300 for price-related content, or implement on-demand revalidation via webhook when prices change in admin panel.

2. **Add `revalidate` to product detail pages**: Currently `producto/[slug]/page.tsx` has no revalidate, making every request a fresh SSR call. Consider adding `revalidate = 300` to reduce server load while keeping prices reasonably fresh.

3. **Implement ISR tags**: Use `revalidateTag()` for targeted invalidation when specific products/categories are updated in admin, rather than time-based revalidation alone.

4. **Monitor cache hit rates**: After setting revalidate values, monitor Vercel edge cache hit rates to ensure the chosen values are effective.

## Summary

Only 2 files have explicit `revalidate` values. The homepage at 3600s is the only one exceeding 600s for price-related content. Most pages are SSR (no caching), which is safe but may incur higher server costs at scale.
