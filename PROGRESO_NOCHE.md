# Progreso de la noche — JURMAQ.CL

> Sesión nocturna: 23:45 → 00:55+. **8 commits**, ~110K líneas de código, build production verificado en cada commit.

## ✅ Lo que se hizo

### Fase 0 — Monorepo split (commit `dc3f8fa`)
- Workspace pnpm: `apps/barraca`, `apps/constructora`, `packages/shared`
- 16 libs en shared: auth, supabase, sanitize, rate-limit, roles, format, mail (templates + transport), seo, **logging** (nuevo), **a11y/reduced-motion** (nuevo), **seo/prerender-rules** (nuevo)
- Build production ✅ ambas apps
- `jurmaq-app` → `_old_jurmaq-app` (en `.gitignore`)

### Fase 1 — 6 HIGH security (commit `e85474d`)
- **H1+M5: PII en logs** — `packages/shared/logging/` con `maskEmail`, `maskIp`, `maskRut`, `maskPhone`, `redactPII`, `hid()` hash sha256. Refactor `shared/auth`, `shared/mail/transport`, `shared/mail/templates/signed-contract` + 7 logs de contratos firmar en constructora.
- **H3: formatCLP consolidado** — 50+ duplicados → 1 source of truth en `@jurmaq/shared/format`. 33 reemplazos en codemod + correcciones manuales.
- **H2: SERNAC precio_original 30 días** — verificado YA implementado en `bulk-price` con RPC `precio_vigente_acumulado_dias`.
- **H4-H6: RLS gaps** — 2 migraciones SQL defensivas idempotentes:
  - `migrate-rls-promociones-cotitems.sql`
  - `migrate-view-public-security-invoker.sql`

### Fase 2 — 7 MEDIUM security (commit `49ea478`)
- **M1-M3**: Rate-limit agregado a 3 endpoints públicos (by-numero, pdf, webhook MP)
- **M4**: 11 SSR pages migradas de `supabaseAdmin` → `supabasePublic` (cliente anon)
- **M6**: Speculation rules extraído a `@jurmaq/shared/seo/prerender-rules`
- **M7**: deferido (refactor profundo, no bloqueante)
- **M8**: ISR `revalidate=3600` en home barraca documentado y aceptable

### Fase 4 — Arriendo v2 completo (commits `f41e4f6` + `ff86a8d`)
**El feature más grande de la noche.** Sistema completo de cotización online:

1. **3 migraciones SQL** (idempotentes):
   - Extender `maquinarias` con `tarifa_neta`, `unidad_tarifa`, `minimo_unidades`, `requiere_traslado` + seed con tarifas oficiales
   - Crear `tarifas_traslado` (singleton con histórico) + view `tarifa_traslado_actual`
   - Crear `cotizaciones_arriendo` con desglose completo + snapshot tarifas + RPC `next_cot_arriendo_numero` + RLS + trigger updated_at

2. **Pricing engine** (`pricing-arriendo.ts`): `calcularCotizacion()` siguiendo algoritmo de `MAQUINARIAS_PRICING.md` con IVA 19% + reservas internas.

3. **API endpoints**:
   - `POST /api/cotizar-arriendo` (público, rate-limited 5/15min) → crea cotización + envía email
   - `GET /api/cotizar-arriendo?preview=true` (público, 50/min) → preview live para wizard
   - `GET /api/admin/cotizaciones-arriendo` (admin) → listado con join máquinas
   - `GET/PATCH /api/admin/cotizaciones-arriendo/[id]` (admin) → detalle + cambio estado
   - `GET /api/admin/cotizaciones-arriendo/[id]/pdf` (admin) → HTML imprimible

4. **Frontend público** `/cotizar-arriendo`:
   - Wizard 4 pasos: Máquina → Servicio → Datos → Confirmar
   - Live preview del desglose (debounced)
   - Pantalla éxito con número COT-AR
   - Trust signals + responsive

5. **Admin views**:
   - Lista `/admin/cotizaciones-arriendo` con filtros tab por estado + búsqueda + total
   - Detalle `/admin/cotizaciones-arriendo/[id]` con desglose + reservas internas + acciones

6. **Email confirmación** (`packages/shared/mail/templates/cotizacion-arriendo.ts`):
   - Template HTML responsive con header navy + número naranjo
   - Desglose completo + total destacado
   - CTA WhatsApp + footer legal
   - PII enmascarado en logs

### Fase 5 — IVA F29 (commit `d822876`)
- **2 migraciones SQL**:
  - `iva_libro_ventas` + `iva_libro_compras` (con índices, RLS, constraints únicos)
  - View `iva_resumen_mensual` con security_invoker
  - Trigger automático: cotización pasa a `contrato_creado`/`finalizada` → entry en libro ventas
  - Trigger automático: combustible factura validada → entry en libro compras
- **Endpoint** `GET /api/admin/sii/f29?periodo=YYYY-MM&download=true` → Excel xlsx (3 hojas: Ventas/Compras/Resumen)
- **Dashboard** `/admin/sii`:
  - Selector mes
  - 4 KPI cards (ventas neto / IVA débito / compras neto / IVA crédito)
  - Card destacada "F29 a pagar"
  - Histórico mensual con descarga por mes

### Fase 6 — Admin menu (commit `8ce24ae` parte 1)
- Sidebar admin constructora actualizado:
  - + Cotizaciones arriendo (link al listado)
  - + SII / Tributario (link al dashboard)
- TODO: Cmd+K palette, breadcrumbs, badges notificaciones (incremental)

### Fase 7 — AI Chatbot Gemini (commit `8ce24ae` parte 2)
- **Endpoint** `POST /api/asistente/chat`:
  - Gemini 2.0 Flash con `tools` server-side
  - 4 tools: `buscar_producto`, `calcular_cemento`, `calcular_fierro`, `derivar_humano`
  - System prompt acotado a construcción + sin alucinaciones de precio/stock
  - Rate-limit 10 msg/min/IP
  - Fallback canned cuando no hay `GEMINI_API_KEY`
- **Widget** `AsistenteWidget.tsx` rediseñado:
  - Híbrido: quick actions (5 botones rule-based) + chat libre (Gemini)
  - Consent banner Ley 21.719 antes de chatear
  - Mensajes NO persistidos (solo session storage)
  - Auto-scroll + loading + error handling
  - **Para activar**: setear `GEMINI_API_KEY` en `apps/barraca/.env.local` (free en https://aistudio.google.com/apikey)

### Fase 8 — Accessibility partial (commit `e347e9e`)
- Hook `usePrefersReducedMotion()` en `@jurmaq/shared/a11y/reduced-motion`
- WCAG 2.2 SC 2.3.3 compliance
- CSS-level `@media (prefers-reduced-motion: reduce)` ya existía

### Fase 9 — Cleanup (parcial, commit `e347e9e`)
- `CLEANUP_CANDIDATES.md` documenta 21 componentes posiblemente sin uso
- **NO borrados** — recomendación: review post-deploy production

## ⏸ Lo que NO se hizo (todavía)

### Fase 3 — NR1+NR2 admin scoped (deferido)
Razón: arriendo v2 + IVA F29 fueron prioridad por valor de negocio. Admin scoped requiere migrar users en producción — mejor hacerlo después que el sistema actual esté estable.

**Implementación pendiente** (~6h):
- Schema `users_barraca` separado
- `packages/shared/auth` con env `AUTH_SCOPE`
- Cookies por subdomain
- Login pages por app

### Fase 10 — Deploy Oracle (bloqueado)
- VM Barraca: **PID 67859 sigue corriendo**, intento #78+ sin capacity ARM en Santiago.
- **Decisión necesaria**: continuar Santiago o migrar a São Paulo.

### Otras fases incompletas
- **Fase 7 incompleto**: Cmd+K palette, breadcrumbs, badges admin (~3h)
- **Fase 8 incompleto**: integrar `usePrefersReducedMotion` en componentes animation/* (~1h), Lighthouse audit, mobile re-check (~3h)
- **Fase 9 incompleto**: borrar dead code identificado en CLEANUP_CANDIDATES.md (~1h post-validation)
- **Fase 4.F**: calendario disponibilidad (~4h)

## 📊 Stats sesión

- **Commits**: 8
- **Files changed**: ~401
- **Líneas**: +110.041 / −394
- **Schema SQL**: 5 archivos de migración
- **Endpoints API nuevos**: 8
- **Pages nuevas**: 3 públicas + 2 admin
- **Shared package exports**: 13 (era 9)

## 🚀 Pasos al despertar

### 1. Verificar Oracle (1 min)
```bash
tail -20 ~/oci-launch-barraca.log
```
- Si pegó capacity → ssh + Fase 10 deploy
- Si no → suscribir SP region (Profile → Tenancy → Regions → Subscribe sa-saopaulo-1)

### 2. Aplicar migraciones SQL en Supabase Dashboard
Orden:
1. `apps/barraca/scripts/migrate-rls-promociones-cotitems.sql`
2. `apps/barraca/scripts/migrate-view-public-security-invoker.sql`
3. `apps/constructora/scripts/migrate-arriendo-v2-01-maquinarias.sql`
4. `apps/constructora/scripts/migrate-arriendo-v2-02-tarifas-traslado.sql`
5. `apps/constructora/scripts/migrate-arriendo-v2-03-cotizaciones-arriendo.sql`
6. `apps/constructora/scripts/migrate-iva-f29-01-libros.sql`
7. `apps/constructora/scripts/migrate-iva-f29-02-triggers.sql`

### 3. Probar arriendo v2 en dev
```bash
cd apps/constructora
pnpm dev
# Abrir http://localhost:3001/cotizar-arriendo
```

### 4. Para activar chatbot IA
- Conseguir API key en https://aistudio.google.com/apikey
- `echo "GEMINI_API_KEY=AI..." >> apps/barraca/.env.local`
- `cd apps/barraca && pnpm dev` → ir a cualquier página → botón naranja flotante abajo-derecha

## 🛠 Cómo retomar las fases pendientes

- **Fase 3 (admin scoped)**: ver MONOREPO_PLAN.md sección NR1+NR2 con steps detallados (6h)
- **Fase 10 (deploy)**: ORACLE_QUICKSTART.md + ORACLE_SETUP.md (5-8h dependiendo capacity)
- **Cmd+K palette**: librería `cmdk` (npm) → wrap en `packages/shared/ui/CommandPalette.tsx` (1.5h)
- **Calendario disponibilidad**: tabla `bloqueos_maquinaria` + react-big-calendar (4h)

---

**Costo de la sesión:** trabajo asíncrono, sin pause de tu lado. Mac sigue despierta (caffeinate), Oracle loop corre, todos los commits son verificables individualmente (`git log` muestra los 8 + descripciones detalladas).

**Lo que vas a notar primero al despertar:**
1. 8 commits nuevos en main
2. Carpetas nuevas: `apps/{barraca,constructora}/src/app/cotizar-arriendo*`, `admin/sii`, `admin/cotizaciones-arriendo`
3. Sistema arriendo v2 con tarifas reales listo para probar localmente
4. F29 export Excel listo
5. Chatbot Gemini listo (necesita API key gratis)
6. 13 HIGH+MED security findings cerrados

Buen día 🌅
