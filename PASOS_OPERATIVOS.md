# Pasos operativos para terminar la auditoría — JURMAQ.CL

Todo el código está listo y typechecks pasaron. Lo que sigue son acciones que **tú tienes que hacer manualmente** en consolas externas (Supabase, Vercel, etc.) porque las reglas de seguridad me prohíben tocar credenciales/infraestructura compartida en tu nombre.

---

## 1. 🔑 Rotar service-role key de Supabase (5 min)

**Por qué urgente:** la key vieja estaba hardcoded en `scripts/assign-images.mjs` y `scripts/image-panel.mjs`. Aunque ya la saqué del código, pudo haber sido commiteada en git history o expuesta de otra forma.

1. Abrir [Supabase Dashboard](https://supabase.com/dashboard) → proyecto `wmoizhbdalvnveclenvf`
2. Settings → API
3. Click en **"Reset"** al lado de `service_role` key
4. Copiar la nueva clave (empieza con `eyJ...`)
5. Pegar en:
   - Vercel Dashboard → tu proyecto → Settings → Environment Variables → `SUPABASE_SERVICE_ROLE_KEY` (Edit, Save)
   - Tu local `jurmaq-app/.env.local` (línea `SUPABASE_SERVICE_ROLE_KEY=...`)
6. **Redeploy** en Vercel (Production tab → Redeploy)
7. Verificar que git history no tiene la key vieja:
   ```bash
   cd /Users/jorgeubilla/Desktop/JURMAQ.CL
   git log --all -p -- jurmaq-app/scripts/assign-images.mjs 2>/dev/null | grep -c JarDNm
   ```
   Si es `> 0`, también necesitas hacer **rewrite history** con `git filter-branch` o `bfg-repo-cleaner` (avísame si necesitas ese paso).

---

## 2. 📋 Ejecutar migraciones SQL (15 min)

**Todas son idempotentes** (puedes correrlas más de una vez sin problema). Sin estas, los endpoints respectivos devuelven `503` con mensaje claro.

Para cada una:
1. Abrir Supabase Dashboard → SQL Editor → New Query
2. Copiar contenido del archivo
3. Run

**Orden recomendado** (sin dependencias entre sí, pero este orden agrupa por dominio):

```
jurmaq-app/scripts/migrate-precio-historial.sql
jurmaq-app/scripts/migrate-pagos-eventos.sql              ⚠ ver nota abajo
jurmaq-app/scripts/migrate-cotizaciones-seq.sql
jurmaq-app/scripts/migrate-cotizaciones-accept-token.sql
jurmaq-app/scripts/migrate-oferta-fin.sql
jurmaq-app/scripts/migrate-firma-token-expiry.sql
jurmaq-app/scripts/migrate-account-erasure-log.sql
jurmaq-app/scripts/migrate-combustible-f29.sql
jurmaq-app/scripts/migrate-rate-limit-persistente.sql
jurmaq-app/scripts/migrate-combustible-iec-tarifas.sql
jurmaq-app/scripts/migrate-email-queue.sql
```

**⚠ Nota sobre `migrate-pagos-eventos.sql`:**
La versión final usa PK compuesta `(payment_id, status)` para soportar las transiciones legítimas de MercadoPago. Si por error ya habías corrido una versión anterior de esta migración (con PK solo `payment_id`), antes de aplicar la nueva ejecuta:
```sql
DROP TABLE IF EXISTS pagos_eventos;
```
y luego sí corre `migrate-pagos-eventos.sql`.

---

## 3. 🌐 Configurar variables de entorno en Vercel (5 min)

Vercel Dashboard → tu proyecto → Settings → Environment Variables. Agregar (o verificar que existen):

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Necesaria para `supabasePublic` en sitemaps (audit A1). Está en Supabase → Settings → API → anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | La nueva, post rotación (paso 1). |
| `MERCADOPAGO_WEBHOOK_SECRET` | Verificación HMAC del webhook MP (audit C3). En MP Dashboard → Webhook secret. |
| `MERCADOPAGO_ACCESS_TOKEN` | Para consultar payments en el webhook. En MP Dashboard → Credentials. |
| `RESEND_API_KEY` | Cliente de email. Resend Dashboard → API Keys. |
| `EMAIL_FROM` | `JURMAQ <noreply@jurmaq.cl>` (con dominio verificado en Resend). |
| `ADMIN_BCC_EMAILS` | `contacto@jurmaq.cl,constructora@jurmaq.cl` (opcional, default OK). |
| `CRON_SECRET` | **NUEVO**: secreto largo (32+ chars random) que protege el cron `/api/cron/email-queue/retry`. Generar con `openssl rand -hex 32`. |
| `NEXTAUTH_URL` | URL pública (`https://jurmaq.cl` en prod). |
| `NEXTAUTH_SECRET` | Para JWT NextAuth. |

Tras editar, **Redeploy** desde Vercel Production tab.

---

## 4. 📦 Verificar bucket `cedulas-firma` privado (2 min)

**Por qué importante:** las cédulas de identidad subidas en el flujo de firma se guardan ahí. Si el bucket es público, todas las cédulas son accesibles vía URL.

1. Supabase Dashboard → Storage
2. Buscar bucket `cedulas-firma`
3. Click en el bucket → Configuration
4. Confirmar que está marcado como **"Private bucket"** (no public)
5. Si es público: ⚠ contactar a un abogado para evaluar notificación a clientes según Ley 21.719 art. 14 y reclasificarlo como privado inmediato.
6. Verificar policies: solo `service_role` debe poder hacer SELECT/UPDATE/DELETE. Anon/authenticated deben tener REVOKE.

---

## 5. ⏰ Configurar cron Vercel para retry de emails (3 min)

Edit `vercel.json` (o crear si no existe) en `jurmaq-app/`:

```json
{
  "crons": [
    {
      "path": "/api/cron/email-queue/retry",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/barraca/promociones/import?mode=expire",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- El primero corre cada 5 min y reintenta emails fallidos.
- El segundo corre diario a las 3am UTC (medianoche Chile) y revierte ofertas con `oferta_fin` vencido.

Vercel **necesita header `x-cron-secret`** o `Authorization: Bearer <CRON_SECRET>`. El cron de Vercel envía automáticamente `Authorization: Bearer <CRON_SECRET>` cuando configuras el env var (paso 3). Si quieres triggerearlo manualmente:
```bash
curl -X POST https://jurmaq.cl/api/cron/email-queue/retry \
  -H "x-cron-secret: TU_CRON_SECRET"
```

---

## 6. 📊 Llenar tarifas IEC oficiales (cuando contador tenga)

El sistema de cálculo automático de IEC funciona pero necesita las tarifas oficiales SII para cada periodo. Sin tarifa configurada, el endpoint devuelve `sin_tarifa: true` y el admin sigue ingresándolo manual (igual que antes).

Cuando el contador tenga las tarifas vigentes (Decreto Supremo correspondiente):

```sql
INSERT INTO combustible_tarifas_iec
  (vigente_desde, tipo_combustible, componente_fijo_clp_litro, componente_variable_utm_m3, utm_referencia_clp, decreto_supremo, created_by)
VALUES
  ('2026-01-01', 'diesel', 60.5, 1.5, 67429, 'DS XXX/2026', 'contacto@jurmaq.cl'),
  ('2026-01-01', 'gasolina_93', 100.2, 6.0, 67429, 'DS XXX/2026', 'contacto@jurmaq.cl');
```

(Los valores son ejemplo. Tu contador o el SII te da los reales.)

---

## 7. ✏️ Actualizar el cliente para usar cookie del carrito (opcional)

A5 implementó cookie `httpOnly` server-side, pero el cliente JavaScript sigue leyendo `localStorage` y mandando `X-Session-Id`. Eso funciona (server prioriza cookie cuando existe), pero hay redundancia.

Cuando estés listo para limpiar:
1. En `src/components/barraca/CartDrawer.tsx`, `AddToCartClient.tsx`, etc., quitar `getSessionId()` que lee localStorage
2. Eliminar header `X-Session-Id` de los fetches (la cookie va sola)
3. Borrar entry `barraca_session_id` del localStorage (`localStorage.removeItem('barraca_session_id')`)

Esto es opcional — el código actual funciona en compatibilidad.

---

## 8. 🔍 Validación post-deploy (10 min)

Una vez desplegado todo:

1. **Login admin** funciona y rate-limit aplica (probar con 6 intentos seguidos email + password incorrectos → bloquea).
2. **Firma de contrato**:
   - Generar contrato de prueba en `/admin/contratos/nuevo`
   - Enviar firma → recibir email con link
   - El link tiene 24h de validez (audit A2)
   - Firmar → verificar que llega email de copia (audit M3 retry queue está como red de seguridad)
3. **Webhook MercadoPago**: hacer un pago de prueba con tarjeta MP test → verificar que cotización pasa a `pagada` y `pagos_eventos` tiene un row.
4. **Promociones Excel**: subir un Excel con `codigo,precio_promocional,fecha_fin` → ver preview con validaciones → aplicar.
5. **Carrito**: agregar producto → cookie `barraca_session` debe aparecer en DevTools → Application → Cookies (httpOnly: ✓).

---

## 🚨 Si algo falla después del deploy

1. Vercel logs: tu proyecto → Logs → buscar `ERROR` o el endpoint específico
2. Supabase logs: Dashboard → Logs → API/Database
3. Si un endpoint devuelve 503: probablemente falta una migración SQL (mensaje del error indica cuál)
4. Si webhook MP no marca `pagada`: verificar `MERCADOPAGO_WEBHOOK_SECRET` configurado y que MP pueda alcanzar tu URL
5. Si emails no llegan: revisar tabla `email_queue` (`SELECT * FROM email_queue WHERE status='failed'`); el `last_error` te dice por qué

---

## 📌 Tareas que dejé sin hacer (cuando regreses, decidimos juntos)

- **Refactor profundo de `src/lib/email.ts`** (separar cada template a su propio archivo). Hoy hice solo el refactor mínimo (transport extraído a `src/lib/mail/transport.ts`). El profundo es trabajo de horas con riesgo, mejor sesión dedicada.
- **Consolidación cliente carrito** (paso 7 arriba). Decisión simple, lo agendamos cuando quieras.
- **Migración full a `supabasePublic` en páginas públicas** (catálogo, productos detalle, etc). Hoy migré sitemaps. Hacer las páginas requiere ajustar uso de `costo` (no expuesto en la vista pública).

---

Generado en sesión autónoma 2026-05-08 → 2026-05-10. Todos los typechecks pasaron exit 0.
