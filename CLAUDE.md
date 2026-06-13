# JURMAQ — Convenciones del monorepo

Monorepo pnpm: `apps/constructora` (jurmaq.cl), `apps/barraca` (barraca.jurmaq.cl), `packages/shared`. Next.js App Router + Vercel + Supabase (Postgres + PostgREST).

- Typecheck: `node ./node_modules/typescript/bin/tsc --noEmit` en cada paquete (el `pnpm` global a veces está roto; usar el binario local).
- Migraciones SQL: NO hay `DATABASE_URL` válido. Aplicar vía Supabase Dashboard → SQL Editor (con Chrome) o REST con `service_role`. Guardar el script en `apps/*/scripts/`.

## Seguridad — reglas obligatorias (auditoría jun-2026)

Estas reglas son OBLIGATORIAS al escribir o modificar código. Existen porque cada una corresponde a una vulnerabilidad real encontrada y corregida. El reporte completo está en `SECURITY_AUDIT_2026-06-12.md`.

### Autenticación y autorización
- **Rutas admin** (`/api/admin/*`): SIEMPRE `requirePermission(modulo, accion)` o `requireRole([...])` de `@jurmaq/shared/auth/guard`, dentro del handler. Nunca confiar solo en el middleware. Devolver `forbiddenResponse()`/`unauthorizedResponse()`.
- **Tokens del portal cliente**: SIEMPRE JWT firmados (`signToken`/`verifyToken` de `@jurmaq/shared/auth/session-token`). PROHIBIDO cualquier token base64 sin firma (`base64("id:random")` es forjable). Fail-closed: si la firma falla, NO emitir token.
- **IDOR**: al usar `supabaseAdmin` (service_role, que BYPASSA RLS) con un id/campo del usuario, validar SIEMPRE ownership primero. Nunca aceptar `usuario_id`/`cliente_id` desde el body — derivarlo de la sesión.

### Input y output
- **Validar bodies** con Zod (`@jurmaq/shared/validation`). No confiar en tipos del cliente; usar `Number.isFinite`/`Number.isInteger`, no solo `Number()` (NaN evade `<`, `>`, `<=`).
- **XSS**: todo dato dinámico inyectado en JSON-LD via `dangerouslySetInnerHTML` DEBE pasar por `safeJsonLd()` de `@jurmaq/shared/seo/jsonld` (escapa `</script>`). En emails HTML, envolver datos de usuario con `escapeHtml()` de `@jurmaq/shared/mail/utils`.
- **Injection PostgREST**: input de usuario dentro de `.or(...)` usa `escapeOrFilter`; dentro de `.ilike(...)` usa `escapeLikePattern` (ambos en `@jurmaq/shared/sanitize`).
- **Mass assignment**: nunca `.insert(body)`/`.update(body)`. Construir el objeto con whitelist explícita de campos.

### Secretos, errores, crypto
- **Comparar secretos** (CRON_SECRET, webhooks, tokens) con `safeSecretEquals` de `@jurmaq/shared/crypto/secret` (timing-safe), nunca con `===`.
- **Fail-closed** en controles de seguridad: un error o un valor con whitespace NUNCA debe terminar permitiendo la acción. (Ej: env flags se comparan con `.trim()`; rate-limit del login admin usa `failClosedOnError: true`.)
- **No filtrar errores** al cliente: nada de `String(error)`/`error.message`/stack en la respuesta. Loguear con `logSafeError` (enmascara PII) y devolver mensaje genérico.
- **PII en logs**: usar `maskEmail`/`maskRut`/`maskIp`/`redactPII`/`logSafe` de `@jurmaq/shared/logging`. Nunca loguear email/RUT/teléfono/token en claro. Tokens/secretos jamás en query strings.
- **Webhooks**: verificar firma HMAC + timing-safe + fail-closed sin secret. Montos de pago SIEMPRE re-calculados server-side desde la DB, nunca confiar en el monto del cliente/webhook.

### Checklist de PR de seguridad
- [ ] ¿Rutas admin con `requirePermission`? ¿endpoints con id de usuario validan ownership?
- [ ] ¿Bodies validados (Zod / `Number.isFinite`)? ¿sin mass assignment?
- [ ] ¿Output escapado (`safeJsonLd` / `escapeHtml`)? ¿`.or()` con `escapeOrFilter`?
- [ ] ¿Secretos comparados timing-safe? ¿controles fail-closed?
- [ ] ¿Sin `String(error)` al cliente? ¿PII enmascarada en logs?
- [ ] ¿Dependencias sin CVEs high (`pnpm audit`)?
