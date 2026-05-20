# Deploy Checklist — JURMAQ.CL (actualizado 2026-05-18)

Branch: `main` · Último commit listo para deploy: ver `git log --oneline -1`

---

## 1) Migraciones SQL pendientes en Supabase production

**Aplicar en Supabase Dashboard → SQL Editor, EN ESTE ORDEN.**

### 🟠 NUEVA: Documentos por maquinaria

Feature pedido por el dueño (subir/descargar revisión técnica, permisos, etc. desde el admin en 1 click). Endpoints + UI ya están en main. Sin la migración el endpoint responde 503 con un mensaje explicando que falta aplicarla.

```sql
-- Pegá íntegro el contenido de:
apps/constructora/scripts/migrate-maquinaria-documentos.sql
```

**Qué hace:**
- Tabla `maquinaria_documentos` (9 tipos: rt, permiso_circulacion, soap, seguro_rc, ficha_tecnica, manual_operacion, mantencion, capacitacion_operador, foto).
- Trigger `maq_docs_updated_at_trigger`.
- Bucket Storage `maquinaria-documentos` privado, 10MB max, MIME pdf/jpeg/png/webp.
- RLS habilitada sin policies para anon/authenticated → solo service_role accede.

**Tras aplicarla:** entrá a `/admin/maquinarias/[id]` (cualquier máquina) → sección Documentos → subí los archivos de `_tmp_docs_maquinaria/` que están en el repo (no commiteados — están en .gitignore).

### 🟠 NUEVA: Documentos por usuario / operario

Mismo flujo que documentos de maquinaria, pero para licencias, contratos, capacitaciones y exámenes psicosensométricos de operarios (ej. carpetas de Matías Zúñiga y Mauricio Ricciardi). Endpoints + UI listos en main; sin migración devuelve 503.

```sql
-- Pegá íntegro el contenido de:
apps/constructora/scripts/migrate-users-documentos.sql
```

**Qué hace:**
- Tabla `users_documentos` (7 tipos: licencia_municipal, cedula, contrato_laboral, capacitacion, examen_psicosensometrico, foto, otro).
- Trigger `users_docs_updated_at_trigger`.
- Bucket Storage `users-documentos` privado, 10MB max, MIME pdf/jpeg/png/webp.
- RLS habilitada sin policies para anon/authenticated.

**Tras aplicarla:** entrá a `/admin/usuarios/[id]` → sección Documentos → subir.

### 🔴 NUEVA: Aislamiento de sesión entre apps (users.scope)

Agrega columna `scope` a la tabla `users` para que cada admin declare a qué app(s) pertenece. Sin esto, después de aplicar los cambios de cookies `__Host-{scope}.session-token` los logins existentes seguirán funcionando, pero la query de auth filtra por scope — usuarios sin scope = `'constructora'` (default).

```sql
-- Pegá íntegro el contenido de:
apps/constructora/scripts/migrate-users-scope.sql
```

**Qué hace:**
- `ALTER TABLE users ADD COLUMN scope text NOT NULL DEFAULT 'constructora'` (default seguro: el personal histórico queda en constructora).
- `CHECK (scope IN ('barraca', 'constructora', 'both'))`.
- Auto-eleva `contacto@jurmaq.cl` a `'both'` (es el dueño — accede a ambos).
- Índice compuesto `(scope, email)` para la query de login.

**Tras aplicarla:** abrí Supabase Dashboard → Authentication → tabla `users` → para cada vendedor/operario de barraca, cambiá su `scope` de `constructora` (default) a `barraca` o `both` según corresponda.

**⚠️ CAMBIO DE COOKIES en este deploy**: las sesiones activas se invalidan porque las cookies pasan a llamarse `__Host-barraca.session-token` y `__Host-constructora.session-token` (antes era `__Secure-next-auth.session-token` con domain compartido). Todos los admins logueados verán "Iniciar sesión" en su próxima visita — comunicarles antes del deploy.

### 🔴 OBLIGATORIA antes de aceptar nuevas ofertas: SERNAC histórico de precios

Compliance Ley 19.496 art. 28. Sin esto, cualquier oferta nueva (`bulk-price create_offer`) devuelve HTTP 503.

```sql
-- Pegá íntegro el contenido de:
apps/barraca/scripts/migrate-precio-historial.sql
```

**Qué hace:**
- Crea `barraca_precio_historial` (precio por producto con vigencia).
- Trigger `trg_barraca_precio_historial` que registra cada UPDATE de precio.
- Backfill inicial: el precio actual de cada producto queda registrado como vigente desde "now" (no retroactivo — el histórico anterior no existe).
- RPC `precio_vigente_acumulado_dias(producto_id, precio, ventana_dias)`.

**Implicancia inmediata:** podés vender normalmente, pero **NO podés crear oferta legítima nueva con el "precio_original" anterior hasta que ese precio haya estado vigente 30 días en el historial** (porque el backfill arranca desde hoy). Si necesitás crear una promo *hoy*, opciones:
1. Esperar 30 días (compliance estricto).
2. Pasar `skipHistorialCheck: true` en el body del request bulk-price (línea 185 del endpoint) — solo para overrides explícitos, queda en logs.
3. Insertar manualmente filas históricas con `vigente_desde` retroactivo si tenés evidencia documental de los precios anteriores.

### 🟢 Ya aplicadas en prod (verificar idempotencia, deberían ser no-ops):

```sql
-- 1. RLS pattern 5 — cerrar anon SELECT en 4 tablas sensibles
apps/constructora/scripts/migrate-rls-pattern5-close-anon-reads.sql

-- 2. RLS promociones + cotizacion_items (si no fue aplicada)
apps/barraca/scripts/migrate-rls-promociones-cotitems.sql

-- 3. View security_invoker (si no fue aplicada)
apps/barraca/scripts/migrate-view-public-security-invoker.sql

-- 4. Migraciones arriendo v2 (si la DB no las tiene)
apps/constructora/scripts/migrate-arriendo-v2-01-maquinarias.sql
apps/constructora/scripts/migrate-arriendo-v2-02-tarifas-traslado.sql
apps/constructora/scripts/migrate-arriendo-v2-03-cotizaciones-arriendo.sql

-- 5. IVA F29
apps/constructora/scripts/migrate-iva-f29-01-libros.sql
apps/constructora/scripts/migrate-iva-f29-02-triggers.sql

-- 6. Sprint 1 (bloqueantes arriendo + cumplimiento legal) — May 2026
apps/constructora/scripts/migrate-disponibilidad-rpc-fix.sql   -- B-1: race condition fix
apps/constructora/scripts/migrate-contrato-html-snapshot.sql   -- B-2: snapshot HTML al firmar
apps/constructora/scripts/migrate-cedula-retention.sql         -- L-1: retención 90d cédulas + audit event_types nuevos

-- 7. Sprint 2 (OTP multi-canal) — May 2026
apps/constructora/scripts/migrate-otp.sql                      -- otp_codigos + otp_eventos (genérico para todos los flujos OTP)

-- 8. Sprint 3 (Portal Cliente Arriendo) — May 2026
apps/constructora/scripts/migrate-clientes-auth.sql            -- password_hash, reset_token, activo, etc en clientes

-- 9. Sprint 4 (Klap Garantías Digitales — Fase A mock) — May 2026
apps/constructora/scripts/migrate-klap-garantias.sql           -- klap_*, garantias_tradicionales, contratos_fotos, garantia_metodo, estados lifecycle

-- 10. Sprint 5 (Mejoras post-comparativa rent a car) — May 2026
apps/constructora/scripts/migrate-catalogo-danos.sql           -- catalogo_danos con 24 ítems seed para pre-llenar montos en inspección

-- 11. Sprint 6 (Barraca e-commerce: cupones + carrito abandonado) — May 2026
apps/barraca/scripts/migrate-cupones.sql                       -- barraca_cupones + barraca_cupones_usos + columnas en barraca_cotizaciones
apps/barraca/scripts/migrate-carrito-abandonado.sql            -- barraca_carrito_abandonado para recovery emails

-- 12. Tier 5+6 (operacional + admin polish) — May 2026
apps/constructora/scripts/migrate-tipos-maquinaria.sql         -- E1: tabla tipos_maquinaria + FK con backfill por nombre
apps/barraca/scripts/migrate-wishlist.sql                      -- D3: barraca_wishlist para clientes logueados
```

Todas son idempotentes (`IF NOT EXISTS` / `OR REPLACE`).

**Crons NUEVOS en barraca/vercel.json**:
- `/api/cron/carrito-recovery` cada 30 min — envía 3-step recovery (1h, 24h, 72h con cupón 10%)

Requiere `CRON_SECRET` en env de **barraca** (puede ser el mismo valor que en constructora).

### Crons en Vercel (apps/constructora/vercel.json)
Asegurar que el `vercel.json` con la sección `crons` esté presente al deploy.
Tras el deploy, verificar en Vercel Dashboard → Settings → Cron Jobs que
aparezcan los 3 jobs:
- `/api/cron/email-queue/retry` cada 5 min
- `/api/cron/contratos/expirar` 3 AM diario
- `/api/cron/cedulas/purgar` 4 AM diario
- `/api/cron/klap-renew-holds` cada hora (en mock NO hace nada salvo si hay holds en DB)

Todos requieren env var `CRON_SECRET` (ver sección 2).

---

## 2) Variables de entorno en producción

Verificá que existan TODAS, **sin valores de placeholder**:

### Comunes a ambos apps
```
DATABASE_URL=postgresql://...
DATABASE_URL_DIRECT=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://wmoizhbdalvnveclenvf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # solo backend, NUNCA al cliente
ADMIN_PASSWORD=<contraseña del seed-admin>
RESEND_API_KEY=re_...
```

### 🔴 NUEVAS este deploy (sesión aislada por app)
```
# apps/barraca/.env.local + Vercel barraca env:
AUTH_SCOPE=barraca
NEXTAUTH_SECRET=<openssl rand -base64 32>      # NUEVO valor, distinto del de constructora

# apps/constructora/.env.local + Vercel constructora env:
AUTH_SCOPE=constructora
NEXTAUTH_SECRET=<openssl rand -base64 32>      # NUEVO valor, distinto del de barraca
```

**Por qué dos secrets distintos**: si la cookie de una app se filtra (XSS o exfiltración), el secret de la otra app no la valida — el JWT firmado con secret-A es inválido con secret-B. Doble cinturón con el cambio de nombre de cookie + `__Host-` prefix.

**Cómo generar**:
```bash
openssl rand -base64 32  # correr dos veces, uno para cada app
```

### Solo barraca (e-commerce)
```
NEXT_PUBLIC_BARRACA_URL=https://barraca.jurmaq.cl
NEXT_PUBLIC_CONSTRUCTORA_URL=https://jurmaq.cl  # para el cross-link en AdminShell
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_WEBHOOK_SECRET=<secret del webhook MP — sin esto el webhook fail-closes>
```

### Solo constructora
```
NEXT_PUBLIC_SITE_URL=https://jurmaq.cl
NEXT_PUBLIC_BARRACA_URL=https://barraca.jurmaq.cl  # para el cross-link en AdminShell
CRON_SECRET=<openssl rand -base64 32>              # protege /api/cron/* contra disparos no autorizados

# OTP WhatsApp via OpenWA (Sprint 2 — opcional, fallback a email si no se setea)
OPENWA_BASE_URL=https://openwa.jurmaq.cl           # URL del gateway OpenWA self-hosted
OPENWA_SESSION=jurmaq                              # session id en el contenedor OpenWA
OPENWA_API_KEY=<openssl rand -base64 48>           # mismo valor que en VM de OpenWA

# OTP WhatsApp via Meta Cloud API (Sprint 2 — plan B si OpenWA es baneado)
WHATSAPP_CLOUD_PHONE_NUMBER_ID=
WHATSAPP_CLOUD_ACCESS_TOKEN=
WHATSAPP_CLOUD_OTP_TEMPLATE=jurmaq_otp
WHATSAPP_CLOUD_LANG=es_CL

# OTP SMS via Twilio (Sprint 2 — opcional, fallback intermedio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Klap Garantías Digitales (Sprint 4) — Fase A vs B
# Sin estos valores: sistema funciona en modo MOCK (responses canned, sin tarjeta real).
# Setear cuando llegue cuenta merchant Klap aprobada:
KLAP_ENABLED=false                                   # 'true' activa modo producción
KLAP_BASE_URL=https://api.pasarela.multicaja.cl       # sandbox o prod según Klap
KLAP_API_KEY=                                         # Api-Key del merchant
KLAP_WEBHOOK_SECRET=                                  # HMAC del webhook
NEXT_PUBLIC_KLAP_MODE=sandbox                         # 'sandbox' o 'production' (controla copy del UI)
```

**Estrategia rollout Klap**:
1. **Fase A (ahora)**: Aplicar migración SQL `migrate-klap-garantias.sql`. KLAP_ENABLED=false. Sistema funcional con mocks: admin puede elegir método, registrar entrega genera entrega_token, cliente entra al portal /cuenta/contratos/[N]/entrega y "autoriza" (mock), aparece hold en /cuenta/garantias, admin inspecciona devolución (cancel/capture mock).
2. **Fase B (cuando llegue cuenta)**: Setear KLAP_API_KEY + KLAP_WEBHOOK_SECRET + KLAP_ENABLED=true + NEXT_PUBLIC_KLAP_MODE=production. Smoke test sandbox Klap. Switch a prod cuando Klap valide.

**Estrategia OTP**: si todas las envs WhatsApp/SMS están vacías, el sistema usa solo email (comportamiento legacy intacto). A medida que activás providers, el dispatcher prioriza WhatsApp → SMS → Email. Ver `infra/openwa/README.md` para setup del gateway.

**`CRON_SECRET`**: lo usan los 3 crons de Vercel
(`/api/cron/email-queue/retry`, `/api/cron/contratos/expirar`,
`/api/cron/cedulas/purgar`). Sin esto, los endpoints están publicly callable y un
atacante puede agotar cuota de Resend o forzar expiraciones. Generar con
`openssl rand -base64 32`. En Vercel: setear el mismo valor en env vars y en
"Cron Jobs → Headers".

### Anti-bypass de CSRF en producción
`packages/shared/src/sanitize/index.ts` línea 68 — `ALLOWED_HOSTS` ya incluye `jurmaq.cl`, `www.jurmaq.cl`, `barraca.jurmaq.cl`. No tocar.

---

## 3) Smoke test post-deploy (3 minutos)

Hacé estos clics en producción, en este orden:

### Constructora (jurmaq.cl)

1. ✅ Home carga con hero + máquinas con "Desde $X/día" (sin `/día/día` duplicado).
2. ✅ Click en una card de máquina → llega a `/maquinarias/[id]` con detalle.
3. ✅ "Cotizar precio final →" lleva a `/cotizar-arriendo?maquinariaId=<id>` y **muestra paso 2 (Servicio) directo**, máquina ya seleccionada.
4. ✅ Llená wizard end-to-end (datos fake) → resumen al final muestra IVA + traslado.
5. ✅ NO confirmes el envío en prod (crearía cotización real).

### Barraca (barraca.jurmaq.cl)

1. ✅ Home carga con `globals.css` aplicado (NO links azules default, sí estilos JURMAQ).
2. ✅ Footer + header tienen iconos chicos (NO los SVG gigantes de antes).
3. ✅ Click en categoría → llega a `/categorias/[slug]` (200, NO 404 con `/barraca/categorias/`).
4. ✅ Click en producto → `/producto/[slug]` con precio + stock.
5. ✅ "Agregar al carrito" → contador del carrito sube (si falla, toast con mensaje claro del error).

### Admin (cualquier dominio + login)

1. ✅ `/login` redirige correctamente (constructora → barraca SSO).
2. ✅ Tras login como admin, sidebar muestra grupos:
   - Constructora: Operaciones / Catálogo / Tributario / Configuración
   - Barraca: Operaciones / Catálogo / Ventas / Marketing
3. ✅ Cmd+K abre command palette con búsqueda.
4. ✅ Crear/editar producto en `/admin/barraca/productos` sin error.
5. ✅ Si intentás crear oferta `bulk-price`:
   - Antes de aplicar migración SERNAC: 503 con mensaje "Falta migracion".
   - Después de aplicar: éxito si el precio actual estuvo vigente 30d.

### REST API anon (verificar Pattern 5 cerrado)

Reemplazá `<ANON>` por la anon key real:

```bash
ANON="..."
URL="https://wmoizhbdalvnveclenvf.supabase.co"

for T in cotizaciones_arriendo proyectos iva_libro_ventas iva_libro_compras; do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$URL/rest/v1/$T?select=id&limit=1" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON")
  echo "$T → HTTP $CODE  (esperado: 401)"
done
```

Las 4 deben dar `401`. Si alguna da 200, la migración RLS Pattern 5 no se aplicó.

---

## 3b) `pnpm audit --prod` (OWASP A06)

Ejecutado pre-deploy. Resultado: **6 vulnerabilidades — todas en deps transitivas, ninguna explotable desde la superficie pública**:

| Severity | Package | Path | ¿Bloquea deploy? |
|---|---|---|---|
| 🟠 high | xlsx (SheetJS) — Prototype Pollution + ReDoS | `apps/barraca`, `apps/constructora` import xlsx para export Excel | ❌ No (admin-only, requiere autenticación) |
| 🟡 moderate (×3) | varias transitivas | next-auth subtree | ❌ No (no expuestas a input no confiable) |
| 🟢 low | nodemailer SMTP command injection (`envelope.size`) | next-auth → @auth/core → nodemailer | ❌ No (no usamos transporte SMTP custom, NextAuth interno) |

**Action plan post-deploy** (~30 min):
```bash
pnpm update xlsx@latest        # cierra los 2 high
# next-auth ya está en versión current; los moderate/low se cierran cuando next-auth release nueva
```

Si querés cerrarlos hoy antes del deploy, corré los `pnpm update` y verificá `pnpm typecheck && pnpm build`. El plan original lo marca como bloqueante solo si hay `critical` (no es el caso).

---

## 4) Webhook MercadoPago

En Mercadopago Dashboard → tu app → Notificaciones → URL del webhook:
```
https://barraca.jurmaq.cl/api/pagos/webhook
```

Y verificá que el **Webhook Secret** coincida con `MERCADOPAGO_WEBHOOK_SECRET` en el .env. Si no coinciden, el endpoint devuelve 401 a TODOS los webhooks (fail-closed por diseño).

---

## 5) Rollback plan

Si algo se rompe tras deploy:

```bash
git revert <último-commit-bueno>..HEAD
# o
git reset --hard <commit-antes-del-deploy>
git push --force-with-lease  # solo si nada externo dependió del commit roto
```

Hot rollback de migraciones SQL — `barraca_precio_historial` se puede dropear sin afectar producción (queda como tabla histórica vacía):

```sql
DROP TRIGGER IF EXISTS trg_barraca_precio_historial ON barraca_productos;
DROP FUNCTION IF EXISTS barraca_precio_historial_track();
DROP FUNCTION IF EXISTS precio_vigente_acumulado_dias(INTEGER,INTEGER,INTEGER);
DROP TABLE IF EXISTS barraca_precio_historial;
```

Las migraciones RLS Pattern 5 son safe — sólo bloquean lecturas no autorizadas. Revertir es opcional.

---

## 6) Pendientes NO-bloqueantes para deploy (post-go-live)

| # | Item | Esfuerzo | Notas |
|---|---|---|---|
| 1 | T3 Cookies separados barraca/constructora | 6h | Romper sesión compartida. Hacerlo en una ventana de mantenimiento. |
| 2 | pnpm lint debt (184 errors mayoría `any`) | 8h | Build/typecheck verdes. Bajar deuda gradualmente. |
| 3 | Hidratación flaky en dev (Turbopack + cards) | 2h | Solo afecta dev local. Prod build OK. |
| 4 | UI/UX polish + WCAG 2.2 AA | 7h | Plan T7 del backlog. |
| 5 | Migrar `<img>` → `<Image>` en barraca | 3h | Performance, no funcional. |
| 6 | Aplicar SERNAC validation a endpoint individual (no solo bulk) | 1h | El bulk ya valida; el individual no permite precio_original (verificado). |

---

## 7) Resumen ejecutivo

✅ **Listo para producción** después de aplicar la migración SERNAC.

| Sistema | Estado |
|---|---|
| Barraca pública (e-commerce) | ✅ Build verde, globals.css, assets, links arreglados |
| Constructora pública (cotizador) | ✅ Wizard end-to-end, precio público coherente con cotizador |
| Admin (panel) | ✅ Sidebar agrupado, RBAC 5 roles, Cmd+K |
| Auth (NextAuth) | ⚠️ Compartida entre subdominios — T3 pendiente |
| MercadoPago | ✅ Webhook HMAC + replay + amount + idempotente |
| Supabase RLS | ✅ Pattern 5 cerrado (4 tablas), policies verificadas |
| SERNAC compliance | ⚠️ Code listo, migración SQL pendiente |
| Build / Typecheck | ✅ Verde en main |

**Lo que NO se hizo y no es bloqueante para mañana:**
- 19 archivos huérfanos eliminados → bundle más liviano. Build sigue verde.
- Lint debt sigue alta (184) pero compila y tipa OK.

---

## 8) Post-deploy roadmap (iteración 2)

Plan completo en `/Users/jorgeubilla/.claude/plans/agregaste-lo-de-revision-rosy-biscuit.md`. Resumen de lo que quedó **deferido** del plan consolidado:

### Bloque 1 — Aislamiento de sesión (~5h, **security urgent**)

Hoy un admin de Barraca con su sesión activa puede entrar al admin de Constructora porque cookie en `domain: '.jurmaq.cl'`, AUTH_SECRET compartido, tabla `users` sin scope. Las 6 acciones del bloque:

1. `packages/shared/src/auth/config.ts`: refactor a `createAuthConfig({ scope })` factory.
2. Cookies por host con prefijo `__Host-barraca.session-token` / `__Host-constructora.session-token` (sin `domain` attribute — el browser fuerza el aislamiento).
3. `AUTH_SECRET` distinto por app (generar 2 con `openssl rand -base64 32`).
4. `AUTH_SCOPE=barraca|constructora` env var por app, leída por el factory.
5. Migración `users.scope` column (text, check IN barraca|constructora|both, default constructora).
6. `packages/shared/src/auth/index.ts:51`: cambiar `.from('users').eq('email', email)` por `.in('scope', [scope, 'both'])`. Callback `session()` valida scope.

**Riesgo de deploy**: rompe sesiones activas (relogin obligatorio). Hacer en ventana de baja actividad. Comunicar a los <10 admins.

### Bloque 2 — AdminShell split (~3h)

`AdminShell.tsx` de constructora (522 LOC) tiene una rama `'barraca'` con `barracaNavItems[]` apuntando a `/admin/barraca/*` (rutas que NO existen post-split — links rotos). Y `apps/barraca/src/app/admin/` no tiene `layout.tsx` propio.

- Eliminar rama `'barraca'` del AdminShell constructora → ~200 LOC menos.
- Crear `apps/barraca/src/components/admin/AdminShell.tsx` con hrefs corregidos (`/admin/productos`, no `/admin/barraca/productos`).
- Crear `apps/barraca/src/app/admin/layout.tsx` con `<SessionProvider>` + `<AdminShell>`.
- Cross-link entre admins via `NEXT_PUBLIC_BARRACA_URL` / `NEXT_PUBLIC_CONSTRUCTORA_URL`.

### Bloque 3.6 — Documentos de personal (~1.5h)

Mirror de Bloque 3 (maquinaria docs) para operarios. Los 22 docs de Matías y Mauricio (en `_tmp_docs_maquinaria/`) entran ahí.

- `apps/constructora/scripts/migrate-users-documentos.sql` (tabla `users_documentos` + bucket `users-documentos`).
- Tipos: `licencia_municipal`, `cedula`, `contrato_laboral`, `capacitacion`, `examen_psicosensometrico`, `foto`, `otro`.
- 4 endpoints en `/api/admin/usuarios/[id]/documentos/`.
- UI tab en `/admin/usuarios/[id]`.

### Bloque 4 — Polish restante (~2h)

- Migrar 8 archivos con `confirm()` nativo a `<ConfirmDialog>` (componente ya disponible en `packages/shared/src/ui/`):
  - barraca: promociones, precios
  - constructora: cotizaciones-arriendo/[id], email-queue, contratos/[id], combustible (3 archivos)
- `min`/`max`/`step` en inputs numéricos admin (categorias parcial, falta productos + maquinarias + precios completos).
- `<label htmlFor>` para a11y en formularios admin.
- Normalizar `rounded-lg` → `rounded-xl` (sed global, low risk).
- Responsive `sm:`/`md:` en /admin/cotizaciones, /admin/suscriptores barraca.

### Bloque 6 — `packages/shared` cleanup (~5h)

- Deprecar `supabaseAdmin` singleton → `createAdminClient()` factory (76 imports).
- Mover 8 mail templates a su app correspondiente.
- `rateLimit()` con `scope` namespace.
- Split `Module` enum en `BarracaModule` + `ConstructoraModule`.
- Mover `CommandPalette.tsx` a constructora.

### Verificación OWASP / blast radius

Después de Bloque 1 + 2:

1. Test aislamiento 2 browsers: barraca login → constructora pide login → ✓.
2. `git ls-files | grep -E '\.env(\.local)?$'` → silencio.
3. `pnpm audit --prod` → 0 highs/criticals.
4. `MERCADOPAGO_WEBHOOK_SECRET` set en prod env.

---

Buen deploy.
