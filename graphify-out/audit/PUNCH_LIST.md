# JURMAQ.CL — Punch List Priorizado (Fase 1 consolidada)

> 2026-05-12. Consolida hallazgos de auditorías 1A (keys), 1B (RLS), 1C (rate limits), 1D (sec review), 1E (precios).

## Resumen ejecutivo

| Severidad | Cantidad | Esfuerzo total estimado |
|---|---|---|
| 🔴 CRITICAL | 4 | 2 h |
| 🟠 HIGH | 6 | 4 h |
| 🟡 MEDIUM | 8 | 6 h |
| 🟢 LOW | 6 | 2 h |
| **Total** | **24** | **~14 h** |

✅ **Buenas noticias:** 0 keys hardcoded. 0 vulnerabilidades de inyección. HMAC + cookies + magic-bytes + OTP timing-safe — todo correcto.

---

## 🔴 CRITICAL — esta semana

### C1. Falta rate-limit en `/api/barraca/carrito` (POST/PUT/DELETE/GET)
- **File:** `src/app/api/barraca/carrito/route.ts:49, 136, 274, 321`
- **Riesgo:** atacante anónimo puede llenar `barraca_carrito` table (storage cost), hammer `getActiveCategoryDiscountMap` (DB pressure).
- **Fix:** agregar `rateLimit({ ip, action: 'cart' }, 30, 60)` en POST/PUT/DELETE; 60/min en GET.
- **Effort:** 20 min.

### C2. Falta rate-limit en `/api/barraca/categorias` GET
- **File:** `src/app/api/barraca/categorias/route.ts:6`
- **Riesgo:** scraper agota Supabase RPM budget.
- **Fix:** `rateLimit` 60/min/IP **o** `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`.
- **Effort:** 10 min.

### C3. Falta rate-limit en `/api/barraca/productos` GET
- **File:** `src/app/api/barraca/productos/route.ts:7`
- **Riesgo:** mismo que C2 + filtros arbitrarios ejecutan `applyDailyPromosToProducts` (más pesado).
- **Fix:** `rateLimit` 30-60/min/IP.
- **Effort:** 10 min.

### C4. Falta rate-limit en `/api/barraca/productos/[slug]` GET
- **File:** `src/app/api/barraca/productos/[slug]/route.ts:6`
- **Riesgo:** 3 queries por request, enumerable por slug.
- **Fix:** `rateLimit` 60/min/IP.
- **Effort:** 10 min.

---

## 🟠 HIGH — este mes

### H1. PII en logs (email, IP cleartext)
- **Files:** `src/lib/auth.ts:73`, `src/lib/mail/transport.ts:82`, `src/lib/mail/templates/signed-contract.ts:128`, +7 más.
- **Compliance:** Ley 21.719.
- **Fix:** crear `src/lib/logging.ts` con `maskEmail()` + `maskIp()`, refactor ~12 archivos.
- **Effort:** 1 h.

### H2. SERNAC: validación `precio_original ≤ max(30 días)` no enforced server-side
- **File:** missing in POST/PUT `/api/admin/barraca/productos/[id]`
- **Compliance:** Ley 19.496.
- **Fix:** check contra `barraca_precio_historial` antes de aceptar `precio_original`. Loggear intento de fake-offer.
- **Effort:** 1.5 h (endpoint + posiblemente trigger SQL).

### H3. Consolidar `formatCLP` — 30+ duplicados → 1 helper
- **Files:** 8 archivos con `const formatCLP` local + 7 con `function formatCLP` + 25+ inline `toLocaleString("es-CL")`.
- **Riesgo:** precio mostrado en producto ≠ carrito ≠ contrato si formato diverge.
- **Fix:** mantener solo `src/lib/format.ts`, eliminar duplicados, grep/replace.
- **Effort:** 45 min.

### H4. RLS gap: `barraca_promociones` sin migración en repo
- **Fix:** confirmar en Supabase Dashboard que tiene RLS + policies. Si no, crear `migrate-rls-promociones.sql`.
- **Effort:** 15 min de verificación + 30 min de migración (si falta).

### H5. RLS gap: `barraca_cotizacion_items` sin migración en repo
- **Fix:** mismo que H4.
- **Effort:** 15 + 30 min.

### H6. Vista `barraca_productos_public` sin `security_invoker=true` confirmado
- **Fix:** verificar en Supabase, recrear con `WITH (security_invoker=true)` si hace falta.
- **Effort:** 30 min.

---

## 🟡 MEDIUM — siguiente sprint

### M1. Rate-limit en `/api/barraca/cotizaciones/by-numero/[numero]` GET
- **File:** `src/app/api/barraca/cotizaciones/by-numero/[numero]/route.ts:5`
- **Fix:** 10-20/min/IP. Numeros tipo `COT-YYYYMMDD-NNN` son enumerable.
- **Effort:** 10 min.

### M2. Rate-limit en `/api/barraca/cotizaciones/[id]/pdf` GET
- **File:** `src/app/api/barraca/cotizaciones/[id]/pdf/route.ts:33`
- **Fix:** 20/min/IP.
- **Effort:** 10 min.

### M3. Rate-limit IP en `/api/barraca/pagos/webhook`
- **File:** `src/app/api/barraca/pagos/webhook/route.ts:65`
- **Fix:** 100/min/IP post-firma (la firma ya bloquea forgery, esto cuida DDoS).
- **Effort:** 10 min.

### M4. `supabaseAdmin` en 11 páginas SSR — migrar a cliente anon
- **Files:** 11 listados en `1B_RLS.md` §4.
- **Riesgo:** policies rotas pasan inadvertidas porque admin bypasses.
- **Effort:** 1 h.

### M5. Error logs exponen `contrato.id` y `pdfBuffer.length`
- **File:** `src/app/api/public/contratos/firmar/[token]/sign/route.ts:296,316,383,385`
- **Fix:** hashear IDs internos para logs (sha256 primeros 8 chars).
- **Effort:** 30 min.

### M6. `speculationrules` ruleset hardcoded en layout
- **File:** `src/app/layout.tsx:185-220`
- **Fix:** extraer a `src/lib/prerender-rules.ts` con tests.
- **Effort:** 30 min.

### M7. Usar `resolvePrice()` en `producto/[slug]/page.tsx`
- **File:** `src/app/barraca/producto/[slug]/page.tsx` (líneas 79, 326, 330, 354, 358, 379)
- **Riesgo:** detalle de producto y carrito pueden divergir.
- **Effort:** 30 min.

### M8. Auditar valores `revalidate` en SSR caches de precio
- **Files:** `barraca/page.tsx`, `barraca/categorias/page.tsx`, `(public)/maquinarias/page.tsx`, `(public)/page.tsx`
- **Fix:** confirmar ≤ 600s.
- **Effort:** 10 min.

---

## 🟢 LOW / observaciones

### L1. Add `import 'server-only'` to `mail/templates/signed-contract.ts`
- **Effort:** 1 min. Defensa en profundidad.

### L2. Verificar policies de tablas "ENABLE RLS sin policy"
- `users`, `barraca_usuarios`, `cotizaciones`, `combustible_facturas`, `contratos*`
- **Effort:** 30 min de verificación en Supabase Dashboard.

### L3. Lint rule custom: bloquear `console.log.*MERCADOPAGO|RESEND|SUPABASE_SERVICE`
- **Effort:** 30 min (eslint plugin custom o regla restricted-syntax).

### L4. Lint rule: rechazar `toLocaleString.*es-CL` sin `formatCLP` import
- **Effort:** 30 min.

### L5. Rate-limit opcional en `/api/public/contratos/firmar/[token]` GET
- **File:** `src/app/api/public/contratos/firmar/[token]/route.ts:14`
- **Riesgo:** muy bajo (token 64-char hex). Solo añadir si paranoia alta.
- **Effort:** 10 min.

### L6. Documentar en `SECURITY_REQUIREMENTS.md` la regla supabaseAdmin
- "Páginas SSR usan cliente anon. Solo admin endpoints + cron + webhooks usan `supabaseAdmin`."
- **Effort:** 10 min.

---

## Cosas que NO hay que arreglar (ya están bien) ✅

- `dangerouslySetInnerHTML` — todos los usos son `JSON.stringify(jsonLd)` o data estática (`GUIAS` const). Sin riesgo XSS.
- MercadoPago webhook HMAC con `timingSafeEqual`. ✅
- OTP comparison con `crypto.timingSafeEqual` + bcrypt. ✅
- File uploads con magic-bytes (no solo extension). ✅
- Cookies `httpOnly + sameSite + secure`. ✅
- Login admin con rate-limit persistente en DB (sobrevive reinicio serverless). ✅
- 0 hardcoded secrets en código. ✅
- 0 vulnerabilidades de SQL injection o XSS. ✅
- `account_erasure_log` para Ley 21.719 right-to-be-forgotten. ✅
- Audit log inmutable para Ley 19.799 firma electrónica. ✅
