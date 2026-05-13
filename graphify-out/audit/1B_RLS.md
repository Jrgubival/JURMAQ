# Audit 1B — RLS Coverage

> Generated 2026-05-12. Fuente: `jurmaq-app/scripts/**` (migraciones SQL) + `jurmaq-app/src/**` (uso runtime).

## 1. Tablas con migración RLS

| Tabla | Archivo migración | Políticas detectadas |
|---|---|---|
| `combustible_tarifas_iec` | `scripts/migrate-combustible-iec-tarifas.sql` | `ENABLE RLS` (políticas: pendiente verificar) |
| `pagos_eventos` | `scripts/migrate-pagos-eventos.sql` | `ENABLE RLS` |
| `role_change_log` | `scripts/migrate-role-change-log.sql` | `service_role_select_role_change_log`, `service_role_insert_role_change_log` |
| `account_erasure_log` | `scripts/migrate-account-erasure-log.sql` | `ENABLE RLS` |
| `rate_limit_attempts` | `scripts/migrate-rate-limit-persistente.sql` | `ENABLE RLS` |
| `email_queue` | `scripts/migrate-email-queue.sql` | `ENABLE RLS` |
| `barraca_precio_historial` | `scripts/migrate-precio-historial.sql` | `ENABLE RLS` |
| `users` | `scripts/archive/2026-04/enable-rls.sql` | `ENABLE RLS` (sin política explícita en archivo) |
| `barraca_usuarios` | `scripts/archive/2026-04/enable-rls.sql` | `ENABLE RLS` |
| `barraca_productos` | `scripts/archive/2026-04/enable-rls.sql` | `productos_public_read` |
| `barraca_categorias` | `scripts/archive/2026-04/enable-rls.sql` | `categorias_public_read` |
| `barraca_cotizaciones` | `scripts/archive/2026-04/enable-rls.sql` | `cotizaciones_barraca_public_read`, `cotizaciones_barraca_public_insert` |
| `barraca_carrito` | `scripts/archive/2026-04/enable-rls.sql` | `carrito_public_all` |
| `barraca_suscriptores` | `scripts/archive/2026-04/enable-rls.sql` | `suscriptores_public_insert` |
| `cotizaciones` | `scripts/archive/2026-04/enable-rls.sql` | `ENABLE RLS` (sin política `SELECT` admin en archivo) |
| `clientes` | `scripts/archive/2026-04/enable-rls.sql` | `ENABLE RLS` |
| `proyectos` | `scripts/archive/2026-04/enable-rls.sql` | `proyectos_public_read` |
| `solicitudes` | `scripts/archive/2026-04/enable-rls.sql` | `solicitudes_public_insert` |
| `maquinarias` | `scripts/archive/2026-04/enable-rls.sql` | `maquinarias_public_read` |
| `contratos_audit_log` | `scripts/archive/2026-04/migrate-firma-fortalecida.sql` | `ENABLE RLS` |
| `combustible_facturas` | `scripts/archive/2026-04/migrate-combustible.sql` | `ENABLE RLS` |
| `combustible_items` | `scripts/archive/2026-04/migrate-combustible.sql` | `ENABLE RLS` |
| `contratos` | `scripts/archive/2026-04/migrate-contratos.sql` | `ENABLE RLS` |
| `contratos_templates` | `scripts/archive/2026-04/migrate-contratos.sql` | `ENABLE RLS` |
| `contratos_otp` | `scripts/archive/2026-04/migrate-contratos.sql` | `ENABLE RLS` |

> Varios `ENABLE RLS` no muestran políticas asociadas en el archivo. Esto significa **RLS activo pero accesible SOLO vía `service_role`** (saltando RLS). Patrón válido para admin-only, pero hay que verificar que ninguna lectura desde cliente anon dependa de esas tablas.

## 2. Tablas usadas por el código

`.from('...')` en `src/**`:

`account_erasure_log`, `barraca_carrito`, `barraca_categorias`, `barraca_cotizacion_items`, `barraca_cotizaciones`, `barraca_productos`, `barraca_productos_public`, `barraca_promociones`, `barraca_suscriptores`, `barraca_usuarios`, `clientes`, `combustible_facturas`, `combustible_items`, `combustible_tarifas_iec`, `contratos`, `contratos_audit_log`, `contratos_otp`, `contratos_templates`, `cotizaciones`, `email_queue`, `maquinarias`, `pagos_eventos`, `proyectos`, `role_change_log`, `solicitudes`, `users`

## 3. GAP — Tablas en código sin migración RLS encontrada

| Tabla | Riesgo | Notas |
|---|---|---|
| `barraca_cotizacion_items` | **ALTO** | Items de cotización barraca, sin migración RLS en `scripts/`. Probablemente creada manualmente en Supabase. Si RLS no está activo, expone datos por API REST anon. |
| `barraca_productos_public` | **BAJO/MEDIO** | Probablemente una vista. Las vistas heredan políticas del owner; debe usar `WITH (security_invoker=true)`. |
| `barraca_promociones` | **ALTO** | Muy usada (lecturas públicas + escrituras admin). Sin migración RLS en `scripts/`. CRÍTICO confirmar estado en Supabase. |
| `rate_limit_attempts` | OK | Tiene migración. Se usa vía RPC `rate_limit_check_and_increment`. |
| `barraca_precio_historial` | OK | Tiene migración. Probablemente alimentada por trigger. |

**TOP-3 GAPs reales:** `barraca_promociones`, `barraca_cotizacion_items`, `barraca_productos_public` (vista).

## 4. supabaseAdmin usage breakdown

**Total files importing `supabaseAdmin`:** ~80
- `src/app/api/**`: 62 files — todos **NECESARIO** (admin endpoints + webhooks + cron + RBAC-protected handlers)
- `src/lib/**`: 11 helpers — **NECESARIO** (auth, rate-limit, email-queue, contratos-audit, promociones-import, etc.)
- `src/app/(public)/**` + `src/app/barraca/**` SSR pages: **11 files — CUESTIONABLE**

### CUESTIONABLE — SSR pages usando service-role para lecturas públicas

Son renders server-side (no exposición al cliente) pero saltan RLS para datos que YA tienen políticas `*_public_read`:

| File | Línea | Tabla |
|---|---|---|
| `src/app/(public)/page.tsx` | 130 | `maquinarias` (featured) |
| `src/app/(public)/maquinarias/page.tsx` | 102 | `maquinarias` |
| `src/app/(public)/maquinarias/[id]/page.tsx` | 57, 69 | `maquinarias` |
| `src/app/(public)/arriendo/[tipo]/page.tsx` | 88 | `maquinarias` filtered |
| `src/app/(public)/arriendo-en/[ciudad]/page.tsx` | 75 | `maquinarias` |
| `src/app/barraca/page.tsx` | 187, 196 | `barraca_categorias`, `barraca_productos` |
| `src/app/barraca/categorias/page.tsx` | 88, 98 | `barraca_categorias`, `barraca_productos` |
| `src/app/barraca/categorias/[slug]/page.tsx` | 41, 50 | `barraca_categorias` |
| `src/app/barraca/producto/[slug]/page.tsx` | 50, 127 | `barraca_productos` |
| `src/app/barraca/material/[slug]/page.tsx` | 140, 149 | `barraca_categorias` |
| `src/app/barraca/buscar/page.tsx` | 62 | `barraca_categorias` |

**Por qué importa:** todos estos datos YA tienen `*_public_read`. Usar `supabaseAdmin` aquí **deja un agujero invisible**: si la policy se rompe, las páginas siguen funcionando (admin bypasses), pero cualquier código nuevo que use cliente anon fallará en silencio.

### PELIGROSO — ninguno detectado
No hay uso de `supabaseAdmin` en código client-side (`'use client'`). El service-role nunca llega al browser. ✅

## 5. Recomendaciones priorizadas

1. **HIGH** — Verificar en Supabase Dashboard que `barraca_promociones` y `barraca_cotizacion_items` tengan RLS habilitada con políticas explícitas. Si no, crear migración `migrate-rls-promociones-items.sql`.
2. **HIGH** — Verificar que `barraca_productos_public` (vista) use `WITH (security_invoker=true)` para que herede política del usuario, no del owner.
3. **MED** — Reemplazar `supabaseAdmin` por cliente anon en los 11 SSR pages. Beneficio: si una policy se rompe, el bug salta en dev en vez de en producción.
4. **MED** — Confirmar en Supabase que `users`, `barraca_usuarios`, `cotizaciones`, `combustible_facturas`, `contratos*` (las que tienen "ENABLE RLS sin policy" en repo) tengan policies explícitas creadas vía Dashboard.
5. **LOW** — Documentar en `SECURITY_REQUIREMENTS.md`: "Páginas SSR usan cliente anon. Solo admin endpoints + cron + webhooks usan `supabaseAdmin`."
