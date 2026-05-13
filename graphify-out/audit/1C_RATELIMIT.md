# Audit 1C — Rate Limiting Coverage

Codebase: `jurmaq-app` (Next.js App Router). Rate-limit helper at `src/lib/rate-limit.ts` exposes `rateLimit()` (in-memory, sliding window) and `rateLimitPersistent()` (DB-backed via Postgres RPC `rate_limit_check_and_increment`, used only by admin NextAuth login). All file paths below are absolute.

## Summary

- **Total route handlers (HTTP methods):** ~95 across 50 route files
- **Public endpoints (no auth required, or anonymous-accessible path):** ~24 methods
- **Public endpoints WITH rate limit:** 17
- **Public endpoints WITHOUT rate limit (critical or medium):** 7
- **Admin/RBAC-protected endpoints (rate-limit nice-to-have):** ~68
- **Critical public unprotected:** 4
- **Medium public unprotected:** 3
- **Webhooks:** 1 (MercadoPago — signature verified). No `webhooks/resend` endpoint exists.

## Critical (public, no rate limit)

| Endpoint | Method | File:line | Risk if abused | Recommended limit |
|---|---|---|---|---|
| `/api/barraca/carrito` | POST / PUT / DELETE / GET | `src/app/api/barraca/carrito/route.ts:49, 136, 274, 321` | Anonymous, only gated by `isValidOrigin` + `sessionId`. Attacker can spam writes to fill the `barraca_carrito` table (storage/DB cost), or hammer `getActiveCategoryDiscountMap`+stock-cap DB lookups on each POST (DB pressure). No per-IP cap. | 30/min per IP for POST/PUT/DELETE; 60/min for GET |
| `/api/barraca/categorias` | GET | `src/app/api/barraca/categorias/route.ts:6` | Public catalog browse; runs two DB queries (count + grouping). Single-IP scraper can exhaust Supabase RPM budget. No cache header set either. | 60/min per IP (or short-TTL cache) |
| `/api/barraca/productos` | GET | `src/app/api/barraca/productos/route.ts:7` | Public product listing with arbitrary `buscar`/`categoria` filters and `applyDailyPromosToProducts` post-processing. Heavier than `/api/barraca/buscar` but lacks the 30/min cap that route has. Trivially scraped/abused. | 30-60/min per IP |
| `/api/barraca/productos/[slug]` | GET | `src/app/api/barraca/productos/[slug]/route.ts:6` | Public product detail; runs 3 DB queries (producto + variants + categoria). Same scraping/exhaustion risk. | 60/min per IP |

Notes:
- `/api/auth/[...nextauth]` (NextAuth handler at `src/app/api/auth/[...nextauth]/route.ts`) does NOT itself call `rateLimit()`, but the Credentials `authorize()` in `src/lib/auth.ts:33-46` calls `rateLimitPersistent(supabaseAdmin, 'admin-login:${ip}:${email}', { maxAttempts: 5, windowSeconds: 900 })`. So admin login IS rate-limited (DB-persistent, survives across serverless lambdas). Counted as OK.
- `/api/cotizaciones` GET (admin-protected) and other admin GET listings are not rate-limited — they require RBAC, so abuse pathway is post-auth (insider/leaked token). Out of scope for this audit's "critical" tier.

## Medium (public, weak/partial RL)

| Endpoint | Method | File:line | Risk | Notes |
|---|---|---|---|---|
| `/api/barraca/cotizaciones/by-numero/[numero]` | GET | `src/app/api/barraca/cotizaciones/by-numero/[numero]/route.ts:5` | Anonymous lookup of a cotización by numero. Numbers are predictable (`COT-YYYYMMDD-NNN`), so an attacker can enumerate. Endpoint does strip PII when email doesn't match, but no rate limit means inventory of valid numbers + checkout funnels can still be harvested. | Add 10-20/min per IP |
| `/api/barraca/cotizaciones/[id]/pdf` | GET | `src/app/api/barraca/cotizaciones/[id]/pdf/route.ts:33` | Anonymous-with-email-match access to the cotización HTML (used for "Imprimir / Guardar como PDF"). Without a cap, attacker can enumerate IDs (sequential integers) — each rejected request still costs a DB hit. | Add 20/min per IP |
| `/api/barraca/pagos/webhook` | POST | `src/app/api/barraca/pagos/webhook/route.ts:65` | Public MercadoPago notification. Signature verification IS performed (`verifyMercadoPagoSignature`, fail-closed if `MERCADOPAGO_WEBHOOK_SECRET` missing), so forgery is blocked. BUT no IP cap → attacker can spam unsigned POSTs (each triggers JSON parse + signature check), inflating Supabase reads and serverless invocations. | Add 100/min per IP — gentle, post-signature short-circuit limits damage |

## OK (rate limited public endpoints)

| Endpoint | Method | File:line | Limit |
|---|---|---|---|
| `/api/auth/[...nextauth]` (admin login via NextAuth Credentials) | POST | `src/lib/auth.ts:38` | 5/15min per `(ip,email)` — DB-persistent via `rateLimitPersistent` |
| `/api/barraca/auth` (cliente register/login) | POST | `src/app/api/barraca/auth/route.ts:164,171` | IP: 5/15min · email: 5/30min (two-layer) |
| `/api/barraca/buscar` | GET | `src/app/api/barraca/buscar/route.ts:9` | 30/min per IP |
| `/api/barraca/carrito` (currently NOT — see Critical above) | — | — | — |
| `/api/barraca/cotizaciones` POST (cliente quote) | POST | `src/app/api/barraca/cotizaciones/route.ts:58` | 5/15min per IP |
| `/api/barraca/cotizaciones/[id]` GET (anonymous owner lookup path) | GET | `src/app/api/barraca/cotizaciones/[id]/route.ts:41` | 5/10min per `(ip, cotid)` — only applied when no session |
| `/api/barraca/cotizaciones/[id]/accept` | POST | `src/app/api/barraca/cotizaciones/[id]/accept/route.ts:117` | 3/15min per `(ip, cotid)` |
| `/api/barraca/cotizaciones/contraoferta-email` | POST | `src/app/api/barraca/cotizaciones/contraoferta-email/route.ts:21` | 20/15min per IP (admin-only, still RL'd as anti-relay) |
| `/api/barraca/cuenta/eliminar` | POST | `src/app/api/barraca/cuenta/eliminar/route.ts:74` | 3/hr per IP |
| `/api/barraca/cuenta/exportar` | POST | `src/app/api/barraca/cuenta/exportar/route.ts:46` | 3/hr per IP |
| `/api/barraca/pagos` | POST | `src/app/api/barraca/pagos/route.ts:21` | 20/min per IP (admin-only, anti-MP-spam) |
| `/api/barraca/promociones/import` | POST | `src/app/api/barraca/promociones/import/route.ts:193` | 30/min per IP (admin-only) |
| `/api/barraca/suscriptores` | POST | `src/app/api/barraca/suscriptores/route.ts:37` | 3/15min per IP |
| `/api/barraca/upload` | POST | `src/app/api/barraca/upload/route.ts:33` | 5/hr per IP |
| `/api/cotizaciones` POST (admin form) | POST | `src/app/api/cotizaciones/route.ts:50` | 5/15min per IP |
| `/api/solicitudes` POST (public contact form) | POST | `src/app/api/solicitudes/route.ts:53` | 3/15min per IP |
| `/api/admin/combustible/upload` | POST | `src/app/api/admin/combustible/upload/route.ts:31` | 30/hr per IP (admin-only) |
| `/api/public/contratos/firmar/[token]` GET | GET | `src/app/api/public/contratos/firmar/[token]/route.ts:14` | NONE — see "Medium" gap below |
| `/api/public/contratos/firmar/[token]/request-otp` | POST | `src/app/api/public/contratos/firmar/[token]/request-otp/route.ts:85` | 3/15min per `contrato_id` |
| `/api/public/contratos/firmar/[token]/sign` | POST | `src/app/api/public/contratos/firmar/[token]/sign/route.ts:55,62` | token: 3/10min · IP: 10/10min |
| `/api/public/contratos/firmar/[token]/upload-identidad` | POST | `src/app/api/public/contratos/firmar/[token]/upload-identidad/route.ts:57,64` | token: 5/10min · IP: 15/10min |
| `/api/public/contratos/firmar/[token]/verify-otp` | POST | `src/app/api/public/contratos/firmar/[token]/verify-otp/route.ts:19` | OTP row-level `MAX_ATTEMPTS=5` w/ atomic CAS — equivalent protection (no per-IP cap, but token-scoped) |

### Additional public-RL gap not yet listed

| Endpoint | Method | File:line | Risk | Recommended |
|---|---|---|---|---|
| `/api/public/contratos/firmar/[token]` | GET | `src/app/api/public/contratos/firmar/[token]/route.ts:14` | Public token-protected endpoint, but token format is checked, not rate-limited. Token enumeration is infeasible (64-char hex = 256 bits), so risk is low. Could still be hit to bypass cache or trigger DB load if a token leaks. | Optional: 30/min per IP |

This is "MED_PUBLIC_NO_RL" but very low priority — added here for completeness.

## OK (admin / RBAC-protected — rate-limit nice-to-have)

All these enforce `requirePermission`, `requireRole`, or session check before processing. Abuse pathway is post-auth only.

### `/api/admin/*` (all RBAC-protected, no per-route RL)
- `/api/admin/combustible/calcular-iec` GET — `combustible:create`
- `/api/admin/combustible/export` GET — `combustible:export`
- `/api/admin/combustible/facturas` GET/POST — `combustible:read|create`
- `/api/admin/combustible/facturas/[id]` GET/PUT/DELETE — `combustible:read|update|delete`
- `/api/admin/combustible/resumen` GET — `combustible:read`
- `/api/admin/combustible/tarifas-iec` GET/POST/DELETE — `combustible:read|update|delete`
- `/api/admin/combustible/upload` POST — `combustible:create` + RL 30/hr (already counted)
- `/api/admin/contratos` GET/POST — `contratos:read|create`
- `/api/admin/contratos/[id]` GET/PUT/DELETE — `contratos:read|update|delete`
- `/api/admin/contratos/[id]/firma-arrendador` POST/DELETE — `contratos:update`
- `/api/admin/contratos/[id]/pdf` GET — `contratos:read`
- `/api/admin/contratos/[id]/render` GET — `contratos:read`
- `/api/admin/contratos/[id]/send-signature` POST — `contratos:update`
- `/api/admin/contratos/templates` GET/POST — `contratos:manage_templates`
- `/api/admin/contratos/templates/[id]` GET/PUT — `contratos:manage_templates`
- `/api/admin/email-queue` GET/POST — `dashboard:read|update`
- `/api/admin/usuarios` GET/POST — role `admin`
- `/api/admin/usuarios/[id]` PUT/DELETE — role `admin`

### `/api/barraca/*` admin-protected
- `/api/barraca/cotizaciones` GET — `barraca_cotizaciones:read`
- `/api/barraca/cotizaciones/[id]` PUT — `auth()` session
- `/api/barraca/cotizaciones/[id]/message` POST — `barraca_cotizaciones:update`
- `/api/barraca/categorias` POST — `auth()` session
- `/api/barraca/email` POST — admin role only (marketing email send)
- `/api/barraca/imagenes/assign` POST — `auth()` session
- `/api/barraca/imagenes/search` GET — `auth()` session (calls external Unsplash/DDG — abuse risk if token leaks; consider per-session RL)
- `/api/barraca/imagenes/similar` GET — `auth()` session
- `/api/barraca/importar` POST — `barraca_importar:create`
- `/api/barraca/importar/parse` POST — `barraca_importar:create`
- `/api/barraca/importar/preview` POST — `barraca_importar:create`
- `/api/barraca/importar/execute` POST — `barraca_importar:create`
- `/api/barraca/productos` POST — `auth()`
- `/api/barraca/productos/[slug]` PUT/DELETE — `auth()`
- `/api/barraca/productos/bulk-image` PUT — `barraca_imagenes:update`
- `/api/barraca/productos/bulk-price` PUT — `barraca_precios:update`
- `/api/barraca/productos/export` GET — `auth()`
- `/api/barraca/promociones` GET (public)/POST/PUT/DELETE — admin for mutations
- `/api/barraca/setup` POST — `admin` role only (seed promotions)
- `/api/barraca/suscriptores` GET — `auth()`
- `/api/barraca/suscriptores/[id]` PUT/DELETE — `auth()`

### Other admin
- `/api/clientes` GET/POST — `clientes:read|create`
- `/api/clientes/[id]` GET/PUT/DELETE — `clientes:read|update|delete`
- `/api/cotizaciones` GET — `cotizaciones:read`
- `/api/cotizaciones/[id]` GET/PUT/DELETE — `cotizaciones:read|update|delete`
- `/api/cron/email-queue/retry` POST — header `x-cron-secret` (CRON_SECRET). No per-IP RL but fully gated.
- `/api/dashboard` GET — `requireAuth()`
- `/api/maquinarias` GET (public catalog)/POST (`maquinarias:create`)
- `/api/maquinarias/[id]` GET (public)/PUT (`maquinarias:update_estado` or higher)/DELETE (`maquinarias:delete`)
- `/api/proyectos` GET/POST — `proyectos:read|create`
- `/api/proyectos/[id]` GET/PUT/DELETE — `proyectos:read|update|delete`
- `/api/seed` POST — `requireAuth()` + role admin
- `/api/solicitudes` GET — `solicitudes:read`
- `/api/solicitudes/[id]` GET/PUT/DELETE — `solicitudes:read|update|delete`

Note on `/api/maquinarias` GET and `/api/maquinarias/[id]` GET: both are PUBLIC (no auth), no rate limit. Same scraping risk as `/api/barraca/productos`. Could be added to Critical/Medium list but data is intentionally public-catalog and lighter (no joins). Recommend 60/min per IP as defense-in-depth.

## Webhook endpoints (signature verification check)

- **`/api/barraca/pagos/webhook`** (MercadoPago) — `src/app/api/barraca/pagos/webhook/route.ts:65`
  - **Signature verified:** YES. HMAC-SHA256 over `id:{data.id};request-id:{x-request-id};ts:{ts};` with `MERCADOPAGO_WEBHOOK_SECRET`. Fail-closed if secret missing (line 21-24). Stale-signature rejection at 300s (line 43). Uses `crypto.timingSafeEqual` on hex-decoded buffers. Idempotency by `(payment_id, status)` in `pagos_eventos` table. Amount validation against cotización total ±1 CLP.
  - **Rate limit:** NO. Flagged Medium above.
- **`/api/webhooks/resend`** — DOES NOT EXIST in this codebase. (Search for `webhooks/resend` returned no matches; no Resend webhook handler present. Bounce/complaint handling for transactional email is not wired up.)

## Recommendations (priority order)

1. **CRITICAL — add per-IP rate limit to `/api/barraca/carrito` (all methods).** Anonymous + write-capable + DB writes. Suggested `cart:${ip}` 30/min for POST/PUT/DELETE, 60/min for GET. File: `src/app/api/barraca/carrito/route.ts`.

2. **CRITICAL — add per-IP rate limit to public catalog scrapers:**
   - `/api/barraca/productos` GET (line 7)
   - `/api/barraca/productos/[slug]` GET (line 6)
   - `/api/barraca/categorias` GET (line 6)
   - `/api/maquinarias` GET + `/api/maquinarias/[id]` GET
   Suggested 30-60/min per IP. These are the most-scraped endpoints; absent a CDN cache they punch through to Supabase.

3. **MEDIUM — rate limit `/api/barraca/pagos/webhook`.** Even with signature verification, an attacker can spam-POST garbage to consume serverless minutes and DB connections during signature check. Add a generous IP cap (e.g. `mp-webhook:${ip}` 100/min, then return 429 before the JSON parse) — gentle so legit MercadoPago bursts pass.

4. **MEDIUM — rate limit `/api/barraca/cotizaciones/by-numero/[numero]` and `/api/barraca/cotizaciones/[id]/pdf`.** Both are unauthenticated (anonymous-with-email-match path) with predictable identifiers. Add 10-20/min per IP to deter enumeration.

5. **LOW — consider implementing `/api/webhooks/resend`** if Resend bounce/complaint tracking is desired (currently absent; bounces are visible only via Resend dashboard). Not a security gap per se, but operational visibility for the email pipeline. Would need signature verification (`svix` SDK) plus rate limit.

6. **LOW — migrate `rateLimit()` callers off in-memory store toward `rateLimitPersistent()`** for endpoints where the limiter is the only barrier (login, OTP, contact). The in-memory `Map` is per-lambda; under Vercel's auto-scaling, a single IP hitting N parallel lambdas effectively gets N× the configured limit. Currently only `/api/auth/[...nextauth]` admin login uses the persistent variant. Highest-value upgrade candidates:
   - `/api/barraca/auth` (cliente login/register)
   - `/api/public/contratos/firmar/[token]/request-otp`
   - `/api/public/contratos/firmar/[token]/sign`
   - `/api/solicitudes` POST (contact form)
   - `/api/barraca/cotizaciones` POST

7. **LOW — `/api/barraca/imagenes/search`** calls Unsplash + DuckDuckGo on each invocation. Admin-only but a compromised session could burn the Unsplash quota. Add a per-session limiter (e.g. 60/hr).
