# JURMAQ.CL — Plan Maestro Consolidado

> Fecha: 2026-05-12. Source of truth para todo el trabajo pendiente.
> Reemplaza/complementa: MONOREPO_PLAN.md, MAQUINARIAS_PRICING.md, ORACLE_*.md, audit reports.

---

## 📊 Resumen ejecutivo

### Lo que está LISTO ✅

| Área | Trabajo | Tiempo invertido |
|---|---|---|
| **Auditoría seguridad** | 5 reports + punch list consolidado | ~3 h |
| **Security CRITICAL** | 4 rate-limits aplicados (carrito, categorias, productos, productos/[slug]) | 45 min |
| **Graphify** | Knowledge graph completo del codebase (1196 nodos, 120 comunidades) | ~30 min |
| **Oracle Cloud infra** | VCN + subnet + IG + Security List + puertos 80/443 | ~30 min |
| **Oracle Cloud auth** | OCI CLI instalado + RSA key + config + API key subida | ~30 min |
| **Oracle launch loop** | Script Python PID 67859 retry capacity con backoff + network drop tolerance | ~30 min |
| **Monorepo workspace** | `pnpm-workspace.yaml`, `package.json` root, `tsconfig.base.json` | 15 min |
| **packages/shared** | Compila clean (auth, supabase, sanitize, rate-limit, roles, format, mail, seo) | 1 h |
| **apps/barraca** | Routes + components + libs + codemod imports + NextAuth handler + middleware | 2 h |
| **apps/constructora** | Mismo set completo + sitemap split + init-db cleanup | 2 h |
| **Plan docs** | MONOREPO_PLAN, MAQUINARIAS_PRICING, ORACLE_QUICKSTART/SETUP | ~2 h |
| **TOTAL DONE** | | **~13 h** |

### Lo que está EN ESPERA ⏳

- **VM Barraca creation**: Oracle Santiago sin capacity ARM Free, retry loop corriendo desde 23:19. Puede tardar horas o días.

### Lo que FALTA hacer ⬜

**Cuantitativo:**
- Punch list audit: 6 HIGH + 8 MEDIUM + 6 LOW (~12 h)
- Monorepo finish (build verify + cleanup): 1 h
- NR1+NR2: Admin scoped + cookies per subdomain (~6 h)
- NR3: Arriendo v2 wizard + pricing engine (~14 h)
- NR4: Admin menus rediseño (~5 h)
- NR5: IVA tracking + F29 export (~8 h)
- AI Chatbot híbrido Gemini (~5 h)
- UI/UX overhaul + GSAP + accessibility (~7 h)
- Cleanup graphify (dead code + dedup) (~3 h)
- Deploy Oracle: provisioning + DNS + monitoring (~6 h)

**Total restante:** ~67 horas (~8-9 días full-time, 3-4 semanas part-time)

---

## 🎯 Fases ordenadas (ejecución recomendada)

> Orden = bloqueo + valor + dependencias. Cada fase es entregable independiente que se puede pausar/retomar.

---

### FASE 0 — Cerrar monorepo (1 h)

**Goal:** Verificar que el split funciona end-to-end y retirar `jurmaq-app/` antes de seguir.

| # | Tarea | Tiempo |
|---|---|---|
| 0.1 | `cp jurmaq-app/.env.local apps/barraca/.env.local` y constructora | 1 min |
| 0.2 | `pnpm --filter @jurmaq/barraca build` (verificar 0 errores fatales) | 5 min |
| 0.3 | `pnpm --filter @jurmaq/constructora build` | 5 min |
| 0.4 | Si ambos OK: `mv jurmaq-app _old_jurmaq-app` | 1 min |
| 0.5 | `.gitignore`: agregar `_old_jurmaq-app/` (no commit) | 1 min |
| 0.6 | Git commit `feat: split into apps/barraca + apps/constructora + packages/shared` | 5 min |

**Deliverable:** Monorepo funcional, jurmaq-app fuera del scope activo.

---

### FASE 1 — Security HIGH wins (4 h)

**Goal:** Cerrar los 6 HIGH del punch list de seguridad. Riesgo real cubierto.

| # | Tarea | Archivo | Tiempo |
|---|---|---|---|
| 1.1 H1 | Crear `packages/shared/src/logging/index.ts` con `maskEmail()`, `maskIp()` | nuevo | 30 min |
| 1.2 H1 | Refactor 12 archivos con `console.log/error` de email/IP | ~12 files | 45 min |
| 1.3 H3 | Consolidar 30+ `formatCLP` duplicados → solo `@jurmaq/shared/format` | codemod + manual | 45 min |
| 1.4 H4-H6 | Conectarse a Supabase Dashboard y verificar RLS de `barraca_promociones`, `barraca_cotizacion_items`, `barraca_productos_public` (vista) | (manual + SQL si falta) | 1 h |
| 1.5 H2 | Endpoint POST `/api/admin/barraca/productos` valida `precio_original ≤ max(30 días)` con `barraca_precio_historial` | apps/barraca/api/admin/productos | 1 h |

**Skills:** `supabase-postgres-best-practices`, `security-requirement-extraction`.
**Deliverable:** PR `feat(security): close 6 HIGH findings from audit`.

---

### FASE 2 — Security MEDIUM (3 h)

| # | Tarea | Tiempo |
|---|---|---|
| 2.1 M1+M2+M3 | Rate-limit en `/api/barraca/cotizaciones/by-numero`, `/pdf`, `/pagos/webhook` | 30 min |
| 2.2 M4 | Migrar 11 SSR pages de `supabaseAdmin` → `supabasePublic` (cliente anon) | 1 h |
| 2.3 M5 | Hash IDs en error logs de contratos firmar | 30 min |
| 2.4 M6 | Extract `speculationrules` ruleset a util testeable | 30 min |
| 2.5 M7 | Usar `resolvePrice()` en `producto/[slug]/page.tsx` (consistencia) | 30 min |
| 2.6 M8 | Auditar `revalidate` ISR (max 600s para precios) | 10 min |

**Deliverable:** PR `feat(security): close 8 MEDIUM findings`.

---

### FASE 3 — NR1 + NR2 Admin scoped + cookies separados (6 h)

**Goal:** Admin Barraca y Admin Constructora con **cuentas distintas**, sin sesión compartida entre subdominios.

| # | Tarea | Archivo | Tiempo |
|---|---|---|---|
| 3.1 | Schema SQL: `CREATE TABLE users_barraca (...)` con mismas columnas que `users` | scripts/migrate-users-split.sql | 30 min |
| 3.2 | Migrar usuarios actuales: copiar admin/gerente/etc → `users` (Constructora), crear seeds en `users_barraca` | SQL migration | 30 min |
| 3.3 | Modificar `packages/shared/auth/index.ts`: leer `process.env.AUTH_SCOPE` (`barraca` o `constructora`) y elegir tabla | shared/auth | 1.5 h |
| 3.4 | Cookies `domain` específicas: barraca → `.barraca.jurmaq.cl`, constructora → `.jurmaq.cl` (no compartidas) | shared/auth/config | 30 min |
| 3.5 | `.env.local` de cada app: `AUTH_SCOPE=barraca` o `=constructora` | configs | 5 min |
| 3.6 | Login pages: app/login/page.tsx en cada app (con branding propio) | apps/*/src/app/login/ | 1 h |
| 3.7 | Tests: login con cuenta Barraca NO entra a Constructora, viceversa | manual/E2E | 30 min |
| 3.8 | Page de "Sesión inválida en este dominio" para casos cruzados | apps/*/src/app/login/error/ | 30 min |
| 3.9 | Documentación en `SECURITY_REQUIREMENTS.md` | docs | 15 min |

**Skills:** `better-auth-security-best-practices` (referencias auth patterns).
**Deliverable:** Admin Barraca y Constructora 100% separados.

---

### FASE 4 — NR3 Arriendo v2 con pricing engine (14 h)

**Goal:** Reemplazar sistema actual "demasiado básico" por wizard de cotización profesional con todas las tarifas reales.

#### 4.A — Schema + seed (2 h)

| # | Tarea | Tiempo |
|---|---|---|
| 4.A.1 | Migración: extender `maquinarias` con `tarifa_neta`, `unidad_tarifa`, `minimo_unidades`, `requiere_traslado` | 30 min |
| 4.A.2 | Migración: crear `tarifas_traslado` (singleton config) | 15 min |
| 4.A.3 | Migración: crear `cotizaciones_arriendo` (replace/migrate de `cotizaciones`) | 30 min |
| 4.A.4 | Seed inicial con tarifas de MAQUINARIAS_PRICING.md | 15 min |
| 4.A.5 | Migración de cotizaciones legacy | 30 min |

#### 4.B — Backend pricing engine (3 h)

| # | Tarea | Tiempo |
|---|---|---|
| 4.B.1 | `apps/constructora/src/lib/pricing-arriendo.ts` con función `calcularCotizacion()` siguiendo algoritmo de MAQUINARIAS_PRICING.md | 1.5 h |
| 4.B.2 | `POST /api/cotizar-arriendo` endpoint público (rate-limited) | 1 h |
| 4.B.3 | Tests unitarios del pricing engine (casos: min hours, traslado, IVA, reservas internas) | 30 min |

#### 4.C — Frontend wizard público (4 h)

| # | Tarea | Tiempo |
|---|---|---|
| 4.C.1 | `/cotizar-arriendo` página: Step 1 selección máquina | 1 h |
| 4.C.2 | Step 2: fecha, lugar (con mapa Google?), horas/días | 1 h |
| 4.C.3 | Step 3: cantidad operarios, peajes, notas | 30 min |
| 4.C.4 | Step 4: resumen con desglose IVA (animado con GSAP) | 1 h |
| 4.C.5 | Confirmación: cliente recibe número `COT-AR-YYYY-NNN` + email con PDF | 30 min |

#### 4.D — Admin views (3 h)

| # | Tarea | Tiempo |
|---|---|---|
| 4.D.1 | `/admin/cotizaciones-arriendo` list con filtros estado | 1 h |
| 4.D.2 | Detail page con desglose interno (reservas mantención + utilidad — admin only) | 1 h |
| 4.D.3 | Botón "Convertir a contrato" — pre-fill data en flujo contrato existente | 1 h |

#### 4.E — PDF + Email (1.5 h)

| # | Tarea | Tiempo |
|---|---|---|
| 4.E.1 | Template PDF cotización (similar al de contrato) | 1 h |
| 4.E.2 | Email template `cotizacion-arriendo-confirmada.ts` | 30 min |

#### 4.F — Calendario disponibilidad (0.5 h placeholder, 4 h si full)

| # | Tarea | Tiempo |
|---|---|---|
| 4.F.1 | MVP: tabla `bloqueos_maquinaria(maquinaria_id, fecha_inicio, fecha_fin, motivo)` + check al cotizar | 1.5 h |
| 4.F.2 | UI calendario admin (FullCalendar.io o react-big-calendar) | 1.5 h |
| 4.F.3 | UI público: "Disponible/No disponible" en wizard step 2 | 1 h |

**Skills:** `frontend-design`, `simplify`, `vercel-react-best-practices`.
**Deliverable:** Sistema arriendo nuevo, profesional, listo para clientes reales.

---

### FASE 5 — NR5 IVA tracking + F29 export (8 h)

**Goal:** Cierre del ciclo SII: cada venta y cada compra automáticamente en libros, export listo para F29.

| # | Tarea | Tiempo |
|---|---|---|
| 5.1 | Schema: `iva_libro_ventas`, `iva_libro_compras` (período, monto_neto, iva, doc_tipo, doc_nro, contraparte) | 1 h |
| 5.2 | Trigger: cotización aceptada o contrato firmado → insert en `iva_libro_ventas` | 1 h |
| 5.3 | UI subir facturas compras: form con fields + storage del PDF (también combustible existente) | 2 h |
| 5.4 | OCR opcional: extraer monto/RUT/folio del PDF con `tesseract.js` (mejorable después con API SII) | 1.5 h (skip si MVP) |
| 5.5 | Export F29 Excel con `xlsx`: hoja ventas + hoja compras + hoja resumen | 2 h |
| 5.6 | Dashboard `/admin/sii/f29`: KPIs ventas netas, IVA débito, compras netas, IVA crédito, F29 a pagar | 1.5 h |

**Skills:** `supabase-postgres-best-practices` (triggers + RLS en tablas tributarias).
**Deliverable:** "Devolución IVA fácil" — export 1-click cada mes.

---

### FASE 6 — NR4 Admin menus rediseño (5 h)

**Goal:** Ambos admin con UX moderna (no la lista plana actual).

| # | Tarea | Tiempo |
|---|---|---|
| 6.1 | `packages/shared/ui/AdminShell.tsx` base con sidebar agrupada por workflow + breadcrumbs + Cmd+K palette | 2 h |
| 6.2 | Constructora `navItems`: secciones Operaciones / Catálogo / Tributario / Configuración (ver MONOREPO_PLAN sección NR4) | 1 h |
| 6.3 | Barraca `navItems`: secciones Catálogo / Ventas / Marketing / Configuración | 1 h |
| 6.4 | Badges de notificaciones (cotizaciones nuevas, contratos por firmar, stock crítico) — leer counts en server-render | 1 h |

**Skills:** `frontend-design`, `web-design-guidelines`, `accessibility`.
**Deliverable:** Admin se siente como software 2025, no 2015.

---

### FASE 7 — AI Chatbot calculadora híbrido (5 h)

**Goal:** Sustituir AsistenteWidget actual (FAQ rígido) por híbrido FAQ + Gemini que ayude a calcular cuánto material necesita.

| # | Tarea | Tiempo |
|---|---|---|
| 7.1 | Sign-up en Google AI Studio + obtener GEMINI_API_KEY → `.env.local` barraca | 10 min |
| 7.2 | Endpoint `POST /api/asistente/chat`: rate-limit + Gemini Flash con system prompt acotado | 1.5 h |
| 7.3 | Tool use: `buscar_producto(query)`, `calcular_cemento({m2, espesor})`, `calcular_fierro({m2, kg_m2})`, `derivar_humano(motivo)` | 1.5 h |
| 7.4 | Refactor AsistenteWidget: quick actions arriba (FAQ rules) + input libre abajo (Gemini) | 1 h |
| 7.5 | Privacy: banner consent + logs efímeros (30 días, sin PII) — Ley 21.719 compliance | 30 min |
| 7.6 | Tests E2E: pregunta de cálculo retorna sugerencia, pregunta de precio → "consulta WhatsApp" | 30 min |

**Skills:** `claude-api` (adaptable a Gemini), `find-skills` → "rag products".
**Costo runtime:** Gemini Flash free tier 15 req/min, 1500 req/día. Gratis al inicio. Si crece se puede migrar a Gemini Flash paid (~$0.10 por millón tokens input).
**Deliverable:** Cliente puede preguntar "¿Cuánto cemento necesito para una losa de 4×3 m?" y recibe respuesta accionable + link a calculadora.

---

### FASE 8 — UI/UX overhaul público + cleanup (7 h)

**Goal:** Ganarle visualmente a Easy.cl/Sodimac/Construmart. Mobile-first sin duplicados.

| # | Tarea | Tiempo |
|---|---|---|
| 8.1 | Borrar BottomNav (ya empezamos, revertí) + verificar nav móvil del hamburguesa | 30 min |
| 8.2 | Consolidar componentes duplicados: `HeroSlideshow` + `HeroSlider` + `MobileHero` → 1 con variants | 1 h |
| 8.3 | GSAP review: `prefers-reduced-motion`, lazy-init en viewport | 1 h |
| 8.4 | Accessibility WCAG 2.2 AA audit: focus states, contraste, alt text, ARIA labels | 2 h |
| 8.5 | Core Web Vitals: LCP < 2.5s, INP < 200ms, CLS < 0.1 → optimizar imágenes con next/image en todos | 1.5 h |
| 8.6 | Mobile-first re-check: container queries en product cards | 1 h |

**Skills:** `accessibility`, `core-web-vitals`, `responsive-design`, `frontend-design`, `vercel-react-best-practices`.
**Deliverable:** Lighthouse mobile ≥ 90 en todas las métricas.

---

### FASE 9 — Cleanup con graphify + commits (3 h)

**Goal:** Borrar dead code que el grafo identificó (378 nodos débilmente conectados, comm cohesion 0.05 en Admin API Endpoints).

| # | Tarea | Tiempo |
|---|---|---|
| 9.1 | `pip install graphifyy` + re-correr `/graphify` sobre `apps/barraca` y `apps/constructora` | 30 min |
| 9.2 | Identificar nodos con 0 inbound edges (dead code) | 30 min |
| 9.3 | Borrar archivos huérfanos confirmados | 1 h |
| 9.4 | Re-run graphify, generar comparación antes/después | 30 min |
| 9.5 | Commit `chore: dead code cleanup based on graphify analysis` | 30 min |

**Skills:** `simplify`, `graphify`.
**Deliverable:** Codebase 15-25% más chico.

---

### FASE 10 — Deploy Oracle (5-8 h, depende de capacity)

**Goal:** Las dos webs corriendo en Oracle Cloud Free tier.

| # | Tarea | Tiempo |
|---|---|---|
| 10.1 | Esperar VM Barraca capacity (puede ser 0h, 1h, días) — script ya corre | (block) |
| 10.2 | Si Santiago no pega capacity en 24-48h: suscribir SP region + recrear VCN ahí + cambiar script al nuevo subnet | 30 min |
| 10.3 | Crear VM Constructora (1 OCPU + 6 GB) | 5 min + retry |
| 10.4 | Provisionar Barraca: Node 20, pnpm, PM2, nginx, certbot, fail2ban, ufw, iptables | 1 h |
| 10.5 | Provisionar Constructora: ídem | 1 h |
| 10.6 | Deploy `apps/barraca` via git clone + `pnpm install && pnpm build && pm2 start` | 1 h |
| 10.7 | Deploy `apps/constructora`: ídem | 1 h |
| 10.8 | Nginx reverse proxy + Certbot SSL auto-renew | 1 h |
| 10.9 | DNS cutover gradual (TTL bajo 24h antes) | 30 min |
| 10.10 | Uptime Kuma monitoring + alertas email | 30 min |
| 10.11 | Convert account to "Paid Plan" (sin costos, desactiva idle reclaim) | 5 min |

**Skills:** `update-config` (deploy automation).
**Deliverable:** jurmaq.cl + barraca.jurmaq.cl en producción Oracle.

---

## 🚀 Orden de ejecución recomendado

**Estrategia:** **value-first + risk-down**. Cerrar agujeros antes de añadir features.

```
SEMANA 1
├── Día 1: Fase 0 (1h) + Fase 1 HIGH security (4h) → 5h
├── Día 2: Fase 2 MEDIUM security (3h) + Fase 3 admin scoped (3h de 6h) → 6h
├── Día 3: Fase 3 finish (3h) + Fase 4.A+4.B arriendo schema + engine (5h) → 8h
└── Día 4: Fase 4.C wizard frontend (4h) + 4.D admin views (3h) → 7h

SEMANA 2
├── Día 5: Fase 4.E+4.F PDF + calendario (5h) + Fase 5.1-5.2 IVA schema + trigger (2h) → 7h
├── Día 6: Fase 5.3-5.6 IVA UI + export (6h) → 6h
├── Día 7: Fase 6 admin menus (5h) + start AI chatbot (2h) → 7h
└── Día 8: Fase 7 chatbot finish (3h) + Fase 8 UI overhaul (5h) → 8h

SEMANA 3 (cleanup + deploy)
├── Día 9: Fase 8 finish (2h) + Fase 9 cleanup (3h) + Fase 10 deploy (3h) → 8h
└── Día 10: Fase 10 finish + DNS + monitoring + buffer → 6h
```

**Total: 68 h / ~10 días full-time.**

### Variante part-time (4 h/día): 17 días = 3.5 semanas calendario

### Variante agresiva (paralelo con subagentes): 6-7 días
- Fases 4 (arriendo) + 5 (IVA) pueden ir parcialmente en paralelo
- Fase 7 (chatbot) y 8 (UI) pueden ir en paralelo

---

## 🎲 Priorización si querés acortar

Si necesitás algo en producción **pronto**, este es el camino mínimo viable:

### MVP en 3 días (~20 h)
1. **Fase 0** — close monorepo (1h)
2. **Fase 1** — security HIGH (4h)
3. **Fase 3** — admin scoped (6h)  
4. **Fase 10** — deploy a Oracle (5-8h cuando pegue capacity)

**Lo que queda fuera:** arriendo v2, IVA F29, AI chatbot, admin UX, UI overhaul. Pero las webs estarían **en producción seguras y separadas**.

### Si querés sumar lo más importante post-MVP
- **+ Fase 4 (arriendo v2)** — 14h → valor de negocio enorme. Es lo que más mueve la aguja para clientes.
- **+ Fase 5 (IVA F29)** — 8h → ahorra horas mensuales de contabilidad.

---

## 📋 Decisiones que necesito de vos

Antes de arrancar Fase 1, confirmar:

1. **¿Empezamos por seguridad (Fase 1) o querés ver arriendo v2 ya (Fase 4)?**
   - Mi voto: seguridad primero. Los agujeros HIGH son riesgo legal/financiero real.
2. **¿Schemas Supabase: una sola DB con tablas separadas, o dos proyectos Supabase?**
   - Mi voto: una DB, dos tablas (`users_barraca`, `users`) por ahora. Migrar a dos proyectos cuando crezca.
3. **Mientras Oracle no tiene capacity, ¿qué hacemos?**
   - Opción A: seguir esperando (script corre, mañana puede pegar).
   - Opción B: suscribir SP + recrear VCN ahí mismo (40 min).
   - Mi voto: A por 24h más, luego B si no pega.
4. **Para el chatbot: ¿OK con Gemini Flash o preferís Claude Haiku 4.5 ($0.25/M tokens, mejor calidad)?**
   - Mi voto: Gemini Flash al inicio (gratis), migrar después si calidad no alcanza.
5. **GitHub repo: ¿hay uno? Necesito conocerlo para deploy via git clone.**

---

## 📈 KPIs de éxito por fase

| Fase | Métrica de éxito |
|---|---|
| 0 | Both apps `next build` OK |
| 1+2 | 0 HIGH security findings, 0 MEDIUM |
| 3 | Login en barraca NO da acceso a constructora |
| 4 | Cliente cotiza online y recibe PDF con desglose correcto |
| 5 | Export F29 mensual sin trabajo manual |
| 6 | Admin nav tiene Cmd+K + breadcrumbs + badges |
| 7 | Chatbot responde "¿cuánto cemento para 10m²?" con número exacto |
| 8 | Lighthouse mobile ≥ 90 |
| 9 | Codebase 15-25% más chico, cohesión comunidades > 0.10 |
| 10 | Ambas webs respondiendo en Oracle con SSL |

---

## 🛡️ Estado de seguridad actual

| Categoría | Estado |
|---|---|
| Hardcoded keys | ✅ 0 issues |
| SQL injection | ✅ 0 issues |
| XSS | ✅ 0 issues |
| HMAC webhook | ✅ MercadoPago verificado |
| Cookies | ✅ httpOnly + sameSite + secure |
| File uploads | ✅ magic bytes |
| OTP | ✅ timing-safe |
| Rate limit endpoints públicos críticos | ✅ 4/4 corregidos |
| Rate limit endpoints MEDIUM | ⬜ 3 pendientes (Fase 2) |
| PII en logs | ⬜ Fase 1 H1 |
| SERNAC 30-day | ⬜ Fase 1 H2 |
| RLS gaps | ⬜ Fase 1 H4-H6 (verificar primero en Dashboard) |

---

## 🗂️ Archivos clave en el repo

| Archivo | Para qué |
|---|---|
| `PLAN_MAESTRO.md` | **Este file** — single source of truth |
| `MONOREPO_PLAN.md` | Detalle del split + NR1-NR6 |
| `MAQUINARIAS_PRICING.md` | Tarifas oficiales + algoritmo + schema SQL |
| `ORACLE_QUICKSTART.md` | Click-by-click para crear VMs |
| `ORACLE_SETUP.md` | Instrucciones provisioning (Nginx, PM2, Certbot) |
| `graphify-out/audit/PUNCH_LIST.md` | 24 findings priorizados |
| `graphify-out/audit/1A-1E_*.md` | Reports detallados por área |
| `graphify-out/graph.html` | Visualización interactiva del grafo |
| `graphify-out/GRAPH_REPORT.md` | God nodes + comunidades + surprising connections |

---

## ⏭️ Next action sugerida

**Cuando retomes:**
1. Verifica el log Oracle: `tail -20 ~/oci-launch-barraca.log`
2. Si VM Barraca todavía no pega → seguir esperando o suscribir SP (decisión #3 arriba)
3. Arrancamos **Fase 0** (cerrar monorepo, 1h) → **Fase 1** (HIGH security, 4h)

Total primer día: **5h** y quedás con monorepo cerrado + 6 HIGH findings resueltos.
