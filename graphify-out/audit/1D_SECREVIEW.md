# Audit 1D — Security Review (OWASP + Chilean compliance)

> Generated 2026-05-12. Excluye hallazgos cubiertos por 1A (keys), 1B (RLS), 1C (rate limits).

## Executive Summary
- HIGH findings: 2
- MEDIUM findings: 4
- LOW / observations: 5
- Compliance gaps: 1 (SERNAC validación 30 días no verificada server-side)

---

## HIGH — fix this week

### H1. PII en logs (email + IP en producción)
- **Location:** `src/lib/auth.ts:73`, `src/lib/mail/transport.ts:82`, `src/lib/mail/templates/signed-contract.ts:128`
- **Description:** `console.log('[admin-login-ok]', { user, email, ip, ua })` y similares loguean email + IP en cleartext. Si Vercel logs se persisten >30 días o son accesibles a terceros (Vercel Pro, Datadog, etc.), viola Ley 21.719.
- **Impact:** Exposición de PII en logs de producción → riesgo de filtrado, multa SERNAC/personal-data.
- **Fix:**
  ```ts
  // Wrapper logSafe: hash email + truncate IP
  function maskEmail(e: string) { return e.replace(/(.{2}).*@/, '$1***@'); }
  function maskIp(ip: string) { return ip.split('.').slice(0,2).concat(['*','*']).join('.'); }
  console.log('[admin-login-ok]', { user: user.id, email: maskEmail(email), ip: maskIp(ip), ua: ua.substring(0, 40) });
  ```
- **Effort:** S — un helper `mask()` en `src/lib/logging.ts` y un grep/replace en ~12 archivos.

### H2. SERNAC `precio_original` validación 30 días — no confirmable server-side
- **Location:** `src/lib/pricing.ts:74` (uso) + falta validación en endpoint POST `/api/admin/barraca/productos`.
- **Description:** El campo `precio_original` se usa para mostrar tachado (oferta). SERNAC Ley 19.496 requiere `precio_original ≤ max(precio últimos 30 días)`. El graph menciona `Fake price terminology removal (SERNAC Ley 19.496)` y `Fake offer pricing subsystem` — hay un sistema pero no se ve dónde se valida server-side al crear/editar.
- **Impact:** Multa SERNAC, demandas colectivas, descrédito de marca.
- **Fix:** En POST/PUT de `/api/admin/barraca/productos/[id]`, antes de aceptar `precio_original`, hacer SELECT contra `barraca_precio_historial` y rechazar si `precio_original > MAX(precio) WHERE producto_id=X AND fecha >= NOW() - INTERVAL '30 days'`. Loggear intento de fake-offer.
- **Effort:** M — endpoint + trigger SQL para `barraca_precio_historial`.

---

## MEDIUM — fix this month

### M1. supabaseAdmin en SSR pages (cubierto en 1B sección 4)
Ver `1B_RLS.md`. 11 páginas usan service-role para reads que ya tienen public-read policies. Migrar a cliente anon.

### M2. Logs de error de email/contrato exponen IDs internos
- **Location:** `src/app/api/public/contratos/firmar/[token]/sign/route.ts:296,316,383,385`
- **Description:** Stack traces con `contrato.id` y `pdfBuffer.length` en logs. Si un atacante puede inducir un error, puede mapear IDs internos a contratos firmados.
- **Fix:** Cambiar a IDs hasheados (`crypto.createHash('sha256').update(id).digest('hex').slice(0,8)`) para logs.
- **Effort:** S.

### M3. `prerender speculationrules` ruleset hard-coded
- **Location:** `src/app/layout.tsx:185-220`
- **Description:** El layout incluye un `<script type="speculationrules">` que pre-renderiza páginas. La lista de exclusiones es manual y fácil de olvidar actualizar (ej: si añades `/admin/nuevo-modulo`, el prerender lo ataca por error y dispara loads innecesarios).
- **Fix:** Mover a un util `getPrerenderRules()` con tests, o usar `not: href_matches: '*'` y allowlist explícito.
- **Effort:** S.

### M4. `process.env.MERCADOPAGO_ACCESS_TOKEN` log sin enmascarar
- **Location:** `src/lib/payments.ts:12`
- **Description:** `console.warn('MERCADOPAGO_ACCESS_TOKEN no configurado, omitiendo creacion de preferencia')` no loguea el valor (✅) pero si en el futuro se cambia a `console.log('Using token:', token)` el riesgo retorna. No es bug actual pero es deuda.
- **Fix:** Añadir lint rule custom o pre-commit hook que bloquee `console.log.*MERCADOPAGO|RESEND|SUPABASE_SERVICE`.
- **Effort:** S.

---

## LOW / observations

### L1. `dangerouslySetInnerHTML` — todos los usos verificados SEGUROS
- 20+ instancias revisadas. Todas son `JSON.stringify(jsonLd)` (SEO structured data) o `s.html` desde const estática `GUIAS` en `src/lib/guias-seo-data.ts`. JSON.stringify auto-escapa `<>&`. ✅ No XSS risk.
- Único caso con HTML literal: `src/app/barraca/guias/[slug]/page.tsx:126` (`s.html`) — fuente: const `GUIAS` (no user input). ✅ Seguro.

### L2. OTP comparison usa `crypto.timingSafeEqual` ✅
`verify-otp/route.ts:102` — bcrypt-compatible, length-checked. Protege contra timing attacks.

### L3. MercadoPago webhook HMAC verification ✅
`webhook/route.ts:49-79` — HMAC SHA-256 con `timingSafeEqual`. ✅

### L4. File upload magic bytes ✅
Tanto `barraca/upload/route.ts` como `upload-identidad/route.ts` validan JPEG/PNG/WebP magic bytes (no solo extension/mimetype).

### L5. Cookie security ✅
`auth.config.ts:28-52` — `httpOnly: true`, `sameSite: 'lax'`, `secure: IS_PROD`. Carrito `barraca/carrito/route.ts:41-43` mismo patrón.

---

## Compliance status

| Ley | Estado | Notas |
|---|---|---|
| **Ley 19.799 (Firma electrónica FES)** | ✅ PASS | OTP por email + audit log inmutable + cédula upload + IP/UA/timestamp registrados. Ver `migrate-firma-fortalecida.sql`. |
| **Ley 19.496 (SERNAC, precio_original)** | ⚠️ PARTIAL | Schema existe (`barraca_precio_historial`) pero validación server-side del cap de 30 días no confirmada al editar productos. Ver H2. |
| **Ley 21.719 (Datos personales)** | ⚠️ PARTIAL | `account_erasure_log` existe pero PII en logs es gap (H1). |

---

## Strengths observed

- Middleware de seguridad bien centralizado (`isValidOrigin`, `requirePermission`, `rateLimit`, `forbiddenResponse`, `sanitizeString`, `getClientIp`) — el grafo lo confirma como columna vertebral
- Webhooks con HMAC + timing-safe compare
- File uploads con magic-bytes (no solo extension)
- Cookie httpOnly + sameSite + secure en producción
- Audit logs inmutables para firma electrónica (Ley 19.799)
- `account_erasure_log` para Ley 21.719 right-to-be-forgotten
- OTP con bcrypt + timing-safe compare
- Rate limiter persistente en DB (no in-memory) — sobrevive reinicio
