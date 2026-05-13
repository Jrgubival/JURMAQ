# Monorepo Split — Plan detallado

> Generated 2026-05-12. Updated 2026-05-12 noche con nuevos requisitos del owner.
> Objetivo: separar `jurmaq-app/` en 2 Next.js apps independientes con código compartido en `packages/shared` **+ rediseño completo del sistema de arriendo y admin separados**.

---

## ⚠️ Nuevos requisitos (agregados 2026-05-12 noche)

Después del plan original, el owner pidió cambios de scope importantes:

### NR1. Admin accounts 100% separados
- **Cuentas distintas para admin Barraca vs admin Constructora.** No solo menús: **users tables separadas por app**.
- Implicación: `packages/shared/auth` debe inicializarse con `process.env.AUTH_SCOPE` (`barraca` o `constructora`), y cada app usa una table `users` propia (o filtra por scope).
- Recomendación: **dos schemas en Supabase** (`barraca.users`, `constructora.users`) o **dos proyectos Supabase**.
- Decisión sugerida: empezar con UN Supabase, **dos tablas separadas** (`users_barraca`, `users_constructora`). Migrar a 2 proyectos Supabase después si crece.

### NR2. Webs completamente separadas
- Independientemente desplegadas (ya en plan)
- Sin sesión compartida — login en barraca.jurmaq.cl NO da acceso a admin.jurmaq.cl ni viceversa
- Cookies con `domain` específico por subdominio (no `.jurmaq.cl`)

### NR3. **Sistema de arriendo v2 — rediseño completo**
El sistema actual es "demasiado básico". Hay que reemplazarlo por uno que cubra:

#### Pricing real (datos en `MAQUINARIAS_PRICING.md`)
| Máquina | Tarifa neta | Unidad | Mínimo |
|---|---|---|---|
| Retroexcavadora | $30.000 | hora | 6 h |
| Miniexcavadora | $25.000 | hora | 6 h |
| Minicargador S650 | $25.000 | hora | 6 h |
| Minicargador S550 | $24.000 | hora | 6 h |
| Minicargador Mustang | $24.000 | hora | 6 h |
| Brazo articulado | $120.000 | día | 1 día |
| Fullen | $80.000 | día | 1 día |
| Genie | $60.000 | día | 1 día |
| Camión tolva | $30.000 | hora | 6 h |

#### Traslado (camión)
- $300/km — considerar ida + vuelta
- Peajes (costo real, ingreso manual)
- Subir/bajar: 30 min de operario fijo
- Operario: $5.000/hora
- Reservas internas (no visibles cliente): 25% mantención + 25% utilidad real

#### Features que tiene que tener arriendo v2
1. **Catálogo con tarifas reales** (no precios genéricos)
2. **Wizard de cotización** público:
   - Cliente elige máquina → ingresa fecha + lugar + horas/días + cantidad operarios
   - Sistema calcula: precio uso + traslado km + carga + horas operario + peajes
   - Muestra desglose con IVA
   - Genera cotización tipo `COT-AR-YYYY-NNN` y la envía por email
3. **Admin de cotizaciones**:
   - Lista filtrable por estado (borrador/enviada/aceptada/rechazada/contrato/finalizada)
   - Ver desglose completo + reservas internas (admin only)
   - Pasar de cotización → contrato firmado en 1 click
4. **Calendario de disponibilidad** por máquina (evitar doble booking)
5. **Cotización a contrato**: pre-llena datos del contrato (cliente, máquina, fecha, monto)
6. **PDF de cotización** con estética igual al contrato actual
7. **Tracking IVA automático** (ver NR5)
8. **Ubicaciones frecuentes**: si el cliente ya pidió antes el sitio, recordar distancia/peajes

### NR4. Admin menus mejorados (Constructora y Barraca, separados)

#### Admin Constructora (jurmaq.cl/admin)
- **Inicio**: dashboard con cotizaciones nuevas, contratos por firmar, F29 del mes, alertas
- **Operaciones**:
  - Cotizaciones arriendo (con cálculo nuevo)
  - Contratos (existente)
  - Solicitudes / Leads
  - Calendario maquinarias
- **Catálogo**:
  - Maquinarias (con tarifa neta, mínimo, etc.)
  - Tarifas traslado (km, operario, reservas)
  - Clientes / Proveedores
- **Combustible** (existente, ya bien)
- **SII / Tributario**:
  - F29 export (combustible + arriendos)
  - IVA neto por período
  - Boletas/facturas pendientes
- **Configuración**:
  - Usuarios + roles
  - Templates contrato
  - JURMAQ data

#### Admin Barraca (barraca.jurmaq.cl/admin)
- **Inicio**: dashboard ventas, cotizaciones, stock crítico
- **Catálogo**:
  - Productos
  - Categorías
  - Promociones
  - Importar Excel
  - Imágenes masivas
- **Ventas**:
  - Cotizaciones
  - Carrito abandonado
  - Email queue
- **Marketing**:
  - Suscriptores
  - Email sequences
- **Configuración**:
  - Usuarios + roles Barraca
  - JURMAQ data

Ambos admin con:
- `Cmd+K` palette
- Breadcrumbs
- Badges de notificaciones
- Bulk actions

### NR5. IVA tracking simplificado (devolución SII)

Hoy `combustible` tiene F29 export. Hay que **extender** para:
- Arriendos: cada cotización aceptada/contrato firmado genera entry en `iva_libro_ventas`
- Compras: módulo para subir facturas de proveedores (combustible ya está bien, agregar para compras generales)
- Botón **"Exportar F29 del mes"** que descarga Excel listo para SII:
  - Hoja "Ventas": cotizaciones + contratos del período con IVA débito
  - Hoja "Compras": facturas combustible + compras + IVA crédito
  - Hoja "Resumen": IVA débito - crédito = a pagar
- Dashboard mensual con KPI: ventas netas, IVA débito, compras netas, IVA crédito, F29 a pagar

### NR6. SEO conservar
- Las landings actuales (city, type, competitor, guías) **no se tocan estructuralmente**
- Sólo se actualizan precios cuando estén ingestados en DB
- Se mantiene `sitemap.ts`, structured data, etc.

---

## Estructura objetivo

```
JURMAQ.CL/
├── package.json                    # workspace root (private, no deps directas)
├── pnpm-workspace.yaml             # define apps/* y packages/*
├── tsconfig.base.json              # config TS base que cada app extiende
├── .gitignore                      # actualizado
│
├── apps/
│   ├── barraca/                    # barraca.jurmaq.cl
│   │   ├── package.json            # deps de barraca
│   │   ├── next.config.ts
│   │   ├── tsconfig.json           # extends ../../tsconfig.base.json
│   │   ├── .env.local              # vars de Barraca
│   │   ├── public/
│   │   │   └── images/...
│   │   ├── scripts/                # migraciones SQL específicas barraca
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (public)/       # ex src/app/barraca/* sin admin
│   │       │   ├── admin/          # ex src/app/admin/barraca/*
│   │       │   ├── api/            # ex src/app/api/barraca/*
│   │       │   ├── error.tsx, not-found.tsx, layout.tsx, loading.tsx
│   │       │   ├── sitemap.ts, robots.ts
│   │       │   └── login/, cuenta/
│   │       ├── components/         # ex src/components/barraca/*
│   │       └── lib/                # libs solo barraca
│   │
│   └── constructora/               # jurmaq.cl
│       ├── package.json
│       ├── next.config.ts
│       ├── tsconfig.json
│       ├── .env.local
│       ├── public/
│       ├── scripts/                # migraciones SQL específicas constructora
│       └── src/
│           ├── app/
│           │   ├── (public)/       # ex src/app/(public)/*
│           │   ├── admin/          # ex src/app/admin/* SIN admin/barraca/
│           │   ├── api/            # api/admin, api/contratos, api/maquinarias, etc.
│           │   ├── contrato/       # public signing flow
│           │   ├── login/
│           │   ├── error.tsx, not-found.tsx, layout.tsx
│           │   ├── sitemap.ts, robots.ts
│           ├── components/         # ex src/components/admin + public
│           └── lib/
│
└── packages/
    ├── shared/                     # código común a las 2 apps
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── auth/               # auth.ts, auth.config.ts, auth-guard.ts
    │       ├── supabase/           # supabase.ts
    │       ├── format/             # format.ts
    │       ├── roles/              # roles.ts (con scopes Constructora/Barraca)
    │       ├── rate-limit/         # rate-limit.ts
    │       ├── sanitize/           # sanitize.ts
    │       ├── mail/               # mail/ y email.ts (base templates)
    │       ├── seo/                # seo-data.ts (compartido base)
    │       └── index.ts            # re-exports
    │
    └── ui/                         # (opcional fase 2) componentes shared
        └── ...                     # ej. AnimatedSection, GSAPInit
```

---

## Mapeo de archivos (basado en análisis de imports)

### `packages/shared/src/` (8 libs core + opcionales)
| Source file | Razón | Bucket sugerido |
|---|---|---|
| `lib/auth.ts` | 16 imports (15 barraca, 1 constr) | `auth/` |
| `lib/auth.config.ts` | parte de auth | `auth/` |
| `lib/auth-guard.ts` | 42 imports (12+30 mixed) | `auth/` |
| `lib/supabase.ts` | 75 imports (35+40 mixed) | `supabase/` |
| `lib/sanitize.ts` | 55 imports (26+29) | `sanitize/` |
| `lib/rate-limit.ts` | 22 imports (16+6) | `rate-limit/` |
| `lib/roles.ts` | 5 imports (1+4) | `roles/` (con scope split) |
| `lib/format.ts` | 4 imports (3+1) | `format/` |
| `lib/email.ts` | 13 imports (6+7) | `mail/` |
| `lib/seo-data.ts` | 5 imports (3+2) | `seo/` |
| `lib/mail/` (dir) | usado por ambos para templates | `mail/templates/` |
| `lib/pdf-generator.ts` | usado por contratos pero podría servir a barraca | `mail/` (utility) |

### `apps/barraca/src/lib/` (9 libs)
- `competidores-data.ts` — alternativa landings
- `email-sequences.ts` — secuencias de email barraca
- `guias-seo-data.ts` — guías barraca
- `import-barraca-smart.ts` — import Excel productos
- `payments.ts` — MercadoPago (solo barraca usa pagos online)
- `pricing.ts` — resolvePrice / getCartPrice (oferta logic)
- `promociones-import-helpers.ts`
- `promotions.ts` — applyDailyPromos
- `search.ts` — full-text search barraca

### `apps/constructora/src/lib/` (8 libs)
- `combustible-utils.ts`
- `contrato-render.ts`
- `contrato-template.ts`
- `contratos-audit.ts`
- `email-queue.ts` — (podría ser shared si barraca también encola, verificar)
- `imagenes-search.ts` — DuckDuckGo image search para products admin
- `init-db.ts`
- `rut.ts`
- `twilio-sms.ts`
- `analytics.ts` — (unused según análisis pero existe — investigar)

---

## Routes split

### `apps/barraca/src/app/`
```
(public)/         ← ex src/app/barraca/* (home, producto, categoria, carrito, cotizacion, calculadoras, etc.)
admin/            ← ex src/app/admin/barraca/* (categorias, productos, promociones, etc.)
api/
  ├── auth/[...nextauth]/route.ts   (NUEVO — handler propio)
  ├── (todo lo de src/app/api/barraca/*)
  └── cron/                          (cron jobs barraca: email-queue, etc.)
login/            ← (admin barraca login)
cuenta/           ← (cliente barraca login)
layout.tsx, error.tsx, not-found.tsx, loading.tsx, sitemap.ts, robots.ts
```

### `apps/constructora/src/app/`
```
(public)/         ← ex src/app/(public)/* (home, arriendo, maquinarias, contacto, terminos, privacidad)
admin/            ← ex src/app/admin/* SIN admin/barraca/ (proyectos, clientes, contratos, combustible, cotizaciones, etc.)
contrato/         ← ex src/app/contrato/* (public signing)
api/
  ├── auth/[...nextauth]/route.ts
  ├── admin/                         (sin barraca admin)
  ├── clientes/, cotizaciones/, contratos/
  ├── cron/
  ├── dashboard/
  ├── maquinarias/, proyectos/, solicitudes/
  └── public/contratos/firmar/      (signing)
login/
layout.tsx, error.tsx, not-found.tsx, sitemap.ts, robots.ts
```

---

## Components split

### `apps/barraca/src/components/`
- `barraca/` (todos los componentes barraca actuales)
- `animations/` (mismo dir, **dupli**ca de constructora — costo de duplicar < complejidad de extraer a `packages/ui`)

### `apps/constructora/src/components/`
- `admin/AdminShell.tsx`, `SessionWrapper.tsx`
- `public/ContactForm.tsx`, `MaquinariaFilters.tsx`
- `animations/` (duplicado)
- Root-level: `Analytics.tsx`, `GSAPInit.tsx`, `Toast.tsx`, `TrustSignals.tsx`, `WhatsAppFloating.tsx` — todos a constructora

**Decisión:** duplicar `animations/` y root-level components. **Razón:** son pocos archivos (~15) y ahorran complejidad de crear un `packages/ui` con build de TSX. Si más adelante se desincronizan, separar.

---

## Configuración del workspace

### `pnpm-workspace.yaml` (root)
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `package.json` (root)
```json
{
  "name": "jurmaq-monorepo",
  "private": true,
  "scripts": {
    "dev:barraca": "pnpm --filter @jurmaq/barraca dev",
    "dev:constructora": "pnpm --filter @jurmaq/constructora dev",
    "build": "pnpm --filter \"./apps/*\" build",
    "build:barraca": "pnpm --filter @jurmaq/barraca build",
    "build:constructora": "pnpm --filter @jurmaq/constructora build",
    "lint": "pnpm --filter \"./**\" lint"
  },
  "devDependencies": {
    "typescript": "^5"
  },
  "engines": {
    "node": ">=20"
  }
}
```

### `tsconfig.base.json` (root)
Compartido por ambas apps + shared. Define `paths` para `@shared/*`.

### Cada `apps/*/package.json`
- Tiene su propio `next`, `react`, `tailwind` (no deduplicados — pnpm hoist los hace eficientes)
- Declara `"@jurmaq/shared": "workspace:*"` como dependencia

---

## Ejecución — pasos discretos (cada uno verificable)

### Paso 1: Workspace skeleton (NO destructivo)
- [ ] Crear `pnpm-workspace.yaml`, `package.json` root, `tsconfig.base.json`
- [ ] Crear estructura vacía: `apps/barraca/src`, `apps/constructora/src`, `packages/shared/src`
- [ ] El `jurmaq-app/` original queda intacto

### Paso 2: Crear `packages/shared`
- [ ] Copiar libs core (auth, supabase, sanitize, rate-limit, roles, format, email, seo-data, mail/)
- [ ] Crear `package.json` con `"name": "@jurmaq/shared"`
- [ ] Crear `src/index.ts` con re-exports
- [ ] Verificar `pnpm build` en shared

### Paso 3: Crear `apps/barraca`
- [ ] `package.json` con `"name": "@jurmaq/barraca"`, deps copiadas de jurmaq-app pero filtradas (sin twilio, etc.)
- [ ] `next.config.ts`, `tsconfig.json`, `tailwind.config`, `postcss.config`, `eslint.config`
- [ ] Copiar `src/app/barraca/*` → `apps/barraca/src/app/(public)/`
- [ ] Copiar `src/app/admin/barraca/*` → `apps/barraca/src/app/admin/`
- [ ] Copiar `src/app/api/barraca/*` → `apps/barraca/src/app/api/`
- [ ] Crear root `src/app/layout.tsx` específico de Barraca
- [ ] Copiar `src/components/barraca/*` + animations + Toast etc.
- [ ] Copiar libs barraca-specific
- [ ] Reescribir imports: `@/lib/auth` → `@jurmaq/shared/auth`
- [ ] `pnpm build` para verificar

### Paso 4: Crear `apps/constructora` (mismo procedimiento)
- [ ] `package.json`, configs
- [ ] Copiar `src/app/(public)/`, `src/app/admin/` sin barraca, `src/app/contrato/`, `src/app/login/`
- [ ] Copiar APIs constructora
- [ ] Componentes admin + public
- [ ] Libs constructora-specific
- [ ] Reescribir imports
- [ ] `pnpm build`

### Paso 5: NextAuth handler en cada app
- [ ] `apps/barraca/src/app/api/auth/[...nextauth]/route.ts`
- [ ] `apps/constructora/src/app/api/auth/[...nextauth]/route.ts`
- [ ] Ambos importan de `@jurmaq/shared/auth`

### Paso 6: Verificación e2e
- [ ] `pnpm dev:barraca` → corre en :3000
- [ ] `pnpm dev:constructora` → corre en :3001
- [ ] Test manual: login en cada uno, una API call, una página

### Paso 7: Cleanup
- [ ] Mover `jurmaq-app/` a `_old_jurmaq-app/` (no borrar todavía)
- [ ] Actualizar `.gitignore`, `vercel.json` si aplica
- [ ] Commit `feat: split monorepo into apps/barraca + apps/constructora + packages/shared`

### Paso 8: (Más tarde) borrar `_old_jurmaq-app/` cuando todo verificado en producción

---

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Imports rotos al mover archivos | Codemod automatizado con `find + sed` o `ts-morph` |
| `next-auth` configurado dos veces (cookies, secret) | Mismo `AUTH_SECRET` en .env de ambas apps |
| Supabase client singleton diferente por app | Cada app instancia el suyo desde `@jurmaq/shared/supabase` con `process.env` propio |
| Build de Next.js no resuelve workspace packages | `transpilePackages: ['@jurmaq/shared']` en cada `next.config.ts` |
| Vercel multi-project setup | Si querés mantener Vercel: crear 2 projects con `rootDirectory` apuntando a `apps/barraca` y `apps/constructora`. Plan original era Oracle igual. |
| Cron jobs duplicados | Cada app cron job tiene su propio path, no se duplican |

---

## Tiempos estimados

### Fase A — Split monorepo base (~6-8 h)

| Paso | Tiempo |
|---|---|
| 1 Skeleton | ✅ DONE |
| 2 Shared | ✅ DONE |
| 3 Barraca | 2-3 h |
| 4 Constructora | 2-3 h |
| 5 NextAuth handlers (con scope NR1) | 30 min |
| 6 Verificación builds | 30 min |
| 7 Cleanup + commit | 20 min |
| **Subtotal Fase A** | **~6-8 h** |

### Fase B — Arriendo v2 (NR3) (~12-16 h)

| Paso | Tiempo |
|---|---|
| B1 Migración SQL: tarifa_neta, unidad, mínimo en `maquinarias` | 30 min |
| B2 Crear `tarifas_traslado` + seed con datos actuales | 30 min |
| B3 Crear `cotizaciones_arriendo` + migrar viejas cotizaciones | 1 h |
| B4 Backend: API quote calculator (`POST /api/cotizar-arriendo`) | 2 h |
| B5 Frontend: Wizard de cotización público (4 pasos) | 3 h |
| B6 Admin: listado + detalle cotizaciones arriendo | 2 h |
| B7 PDF cotización con desglose IVA | 2 h |
| B8 Email automático al cliente con PDF adjunto | 1 h |
| B9 Calendario disponibilidad por máquina | 2 h |
| B10 Cotización → Contrato (pre-llenado) | 1 h |
| **Subtotal Fase B** | **~14 h** |

### Fase C — Admin separado por scope (NR1, NR2, NR4) (~8-10 h)

| Paso | Tiempo |
|---|---|
| C1 Schema separado: `users_barraca`, `users_constructora` | 1 h |
| C2 Migrar users actuales a las dos tablas | 30 min |
| C3 Configurar `packages/shared/auth` con scope env var | 1.5 h |
| C4 Cookies domain por subdominio | 30 min |
| C5 Login pages por app | 1 h |
| C6 Admin shell Constructora con secciones de NR4 | 2 h |
| C7 Admin shell Barraca con secciones de NR4 | 1.5 h |
| C8 Cmd+K palette compartido (packages/shared/ui) | 1.5 h |
| **Subtotal Fase C** | **~9 h** |

### Fase D — IVA tracking + F29 export (NR5) (~6-8 h)

| Paso | Tiempo |
|---|---|
| D1 Schema `iva_libro_ventas`, `iva_libro_compras` | 1 h |
| D2 Trigger: cotización aceptada → entry en libro ventas | 1 h |
| D3 Subida de facturas compras (UI + storage) | 2 h |
| D4 Export F29 Excel (3 hojas) | 2 h |
| D5 Dashboard IVA mensual con KPIs | 1.5 h |
| **Subtotal Fase D** | **~8 h** |

### TOTAL

| Fase | Tiempo | Crítico? |
|---|---|---|
| A — Monorepo split | 6-8 h (2 h ya hechas) | Bloqueante |
| B — Arriendo v2 | 12-16 h | Alta valor negocio |
| C — Admin separado | 8-10 h | Necesario |
| D — IVA tracking | 6-8 h | Alta valor negocio |
| **Total restante** | **~32-42 h** | |

### Orden recomendado de ejecución

1. **A** primero (base técnica) — sin esto nada de lo demás se puede hacer limpio
2. **C** segundo (auth scopes) — necesario antes de B porque B crea cotizaciones que necesitan saber qué admin las ve
3. **B** tercero (arriendo v2) — feature big, pero independiente
4. **D** cuarto (IVA) — depende de tener cotizaciones nuevas (B) para tracking completo

Paralelo posible: D1-D3 (schemas + UI base) puede arrancar mientras B se desarrolla.

---

## Decisiones pendientes que necesito confirmar

1. **¿Una sola Supabase o split?** Sugerencia: una sola por ahora (más simple). Split después si crece.
2. **¿Mantener `_old_jurmaq-app/` cuánto tiempo?** Sugerencia: 2 semanas o hasta que producción esté estable.
3. **¿Vercel multi-project o solo Oracle?** Si vamos a Oracle, Vercel queda como backup → mantener config pero no usar.
4. **¿Componentes `animations/` se duplican o se extraen a `packages/ui`?** Sugerencia: duplicar (menos complejidad). Re-evaluar si se desincronizan.
5. **¿AdminShell se duplica?** Cada app tiene su propio (porque navItems son diferentes). Sugerencia: duplicar, no extraer.

---

## Próximo paso

Si aprobás este plan, ejecuto **Paso 1 + 2** (skeleton + shared) — son 45 min, no destructivos.
Después de eso parsamos el resto en sesiones más cortas.
