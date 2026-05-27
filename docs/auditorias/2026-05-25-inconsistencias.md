# Auditoría de Inconsistencias — JURMAQ.CL

**Fecha**: 2026-05-25
**Alcance**: monorepo completo (`apps/barraca`, `apps/constructora`, `packages/shared`)
**Método**: 4 subagentes Explore en paralelo (read-only) + consolidación
**Estado del repo**: `main` + 13 archivos modificados + 7 untracked (incluye `FleteCalculator.tsx`, `valdivieso.png`)
**Cambios en código**: **ninguno** — este reporte es el único artefacto generado.

---

## 1. Resumen ejecutivo

### KPIs

| Severidad | Hallazgos | Archivos afectados |
|-----------|-----------|--------------------|
| 🔴 CRÍTICO | 1 | 1 |
| 🟠 ALTO | 6 | ~30 |
| 🟡 MEDIO | 9 | ~80 |
| 🟢 BAJO | 7 | ~20 |
| ✅ Verificado OK | 6 | n/a |
| **TOTAL** | **29** | **~131** |

**Plan de remediación**: 12 bloques (3 🔴 + 4 🟠 + 4 🟡 + 1 🟢) · esfuerzo total ~7 h.

> Nota: los bloques 🔴 CRÍTICO-2 y CRÍTICO-3 del plan agrupan hallazgos 🟠/🟡 que individualmente no son críticos, pero se elevan a prioridad máxima por **riesgo legal/operativo** combinado (direcciones mezcladas en templates de arriendo; nombre legal híbrido en PDFs).

### Hallazgos destacados (top 5)

1. **🔴 Footer de constructora muestra un número de WhatsApp distinto al canonical** (`+56 9 9299 4452` vs `+56 9 7667 3577`). Riesgo de conversión inmediato.
2. **🟠 Constructora sin `og:image` por defecto en metadata raíz**. Shares en redes sociales no muestran miniatura — CTR reducido.
3. **🟠 `globals.css` divergente entre apps**: utilities `.editorial-h1`, `.tabular-nums`, `.reveal-on-load` sólo existen en constructora. Cualquier componente compartido en el futuro se rompe.
4. **🟠 Dos direcciones legales reales mezcladas**: Av. Poniente 2157 (Molina, barraca) vs LT 3 Maquehua (Curicó, constructora). Templates de email confunden cuál usar.
5. **🟠 15+ mensajes de WhatsApp hardcodeados sin helper centralizado** (`buildWhatsAppText()`). Cambiar el saludo requiere editar 15 archivos.

### Aspectos positivos confirmados

- ✓ Fix del template `"%s | JURMAQ" → "%s"` aplicado y sin regresión.
- ✓ Sin imports cruzados barraca ↔ constructora (arquitectura limpia).
- ✓ Versiones de deps idénticas (`next@16.2.6`, `react@19.2.6`, `next-auth@5.0.0-beta.31`).
- ✓ Todos los componentes con hooks tienen `"use client"` correctamente.
- ✓ Sin imágenes 404 en filesystem (incluido `valdivieso.png`).
- ✓ Alt text presente en imágenes críticas.
- ✓ Sitemaps bien implementados con `MetadataRoute.Sitemap`.

---

## 2. Hallazgos por categoría

> Severidad: 🔴 CRÍTICO = afecta conversión/compliance ahora · 🟠 ALTO = SEO/branding/UX · 🟡 MEDIO = consistencia interna · 🟢 BAJO = optimización menor.

---

### 2.1 Teléfonos & WhatsApp

#### 🔴 L-1 — Footer constructora con número divergente
- **Canonical**: `+56 9 7667 3577` (`LEGAL_INFO.HQ.telefono` en `packages/shared/seo/index.ts`)
- **Encontrado**: `+56 9 9299 4452` × 1
- **Ubicaciones**:
  - [apps/constructora/src/components/public/Footer.tsx:64-65](apps/constructora/src/components/public/Footer.tsx#L64)
- **Recomendación**: confirmar si es número válido de constructora (caso → agregar a `LEGAL_INFO` como `HQ_CONSTRUCTORA.telefono`) o reemplazar por el canonical.

#### 🟠 L-2 — Número de maestros no centralizado
- **Encontrado**: `+56 9 8322 1440` × 2 (hardcoded, no en LEGAL_INFO)
- **Ubicaciones**:
  - [packages/shared/src/mail/templates/admin-manual-arriendo.ts:53-54](packages/shared/src/mail/templates/admin-manual-arriendo.ts#L53)
  - [apps/barraca/src/app/maestros/[codigo]/page.tsx:146](apps/barraca/src/app/maestros/[codigo]/page.tsx#L146)
- **Recomendación**: agregar como `LEGAL_INFO.maestros_whatsapp` e importar en ambos lugares.

#### 🟢 L-3 — Placeholders `+56912345678` en templates dormidos
- **Encontrado**: `+56 9 1234 5678` × 2 (placeholders) + 3 más en HTML `placeholder=`
- **Ubicaciones**:
  - [packages/shared/src/mail/templates/cotizacion-arriendo.ts:116](packages/shared/src/mail/templates/cotizacion-arriendo.ts#L116)
  - [apps/barraca/src/app/pago/error/page.tsx:61](apps/barraca/src/app/pago/error/page.tsx#L61)
- **Recomendación**: si el template/página están en uso real, reemplazar con `LEGAL_INFO.HQ.telefono`; si son código muerto, eliminar.

---

### 2.2 Nombre legal / Razón social

#### 🟡 L-4 — "Razón social" vs "nombre comercial" mezclados
- **Variantes en uso**:
  - `Constructora JURMAQ` (comercial, usado en footer) ✓
  - `Constructora Jorge Ubilla Rivera E.I.R.L.` × ~40 (razón social legal, usado en contratos/términos) ✓
  - `JURMAQ E.I.R.L.` × 1 en PDF de cotización — ❌ híbrido confuso
- **Ubicaciones (muestra)**:
  - [apps/constructora/src/lib/contrato-template.ts:224,251](apps/constructora/src/lib/contrato-template.ts#L224) — razón social ✓
  - [apps/barraca/src/app/api/cotizaciones/[id]/pdf/route.ts:574](apps/barraca/src/app/api/cotizaciones/[id]/pdf/route.ts#L574) — `JURMAQ E.I.R.L.` ❌
- **Recomendación**:
  1. Documentar en `LEGAL_INFO` la distinción explícita: `nombreLegal` (razón social completa) vs `nombreComercial`.
  2. Política: razón social SOLO en documentos vinculantes (contratos, T&C, privacidad, PDFs). Nombre comercial en marketing/footer/emails.
  3. Eliminar el híbrido `JURMAQ E.I.R.L.` del PDF.

---

### 2.3 SEO & Metadata

#### 🟠 S-1 — Constructora sin `og:image` por defecto
- **Severidad**: ALTO
- **Ubicaciones**:
  - [apps/constructora/src/app/layout.tsx](apps/constructora/src/app/layout.tsx) — no define `openGraph.images`
  - [apps/constructora/src/app/page.tsx:150-156](apps/constructora/src/app/page.tsx#L150) — define `images: [{url: "/icon-512.png", width: 512, height: 512}]` (dimensiones sub-óptimas)
  - [apps/constructora/src/app/como-funciona/page.tsx:13-18](apps/constructora/src/app/como-funciona/page.tsx#L13) — sin `images`
- **Impacto**: shares en Facebook/LinkedIn/WhatsApp sin miniatura visual → CTR -30% típico.
- **Recomendación**: crear `/public/og-image-1200x630.png` y agregar a `layout.tsx` como fallback global; verificar todas las pages dinámicas.

#### 🟠 S-2 — Producto y maquinaria sin `og:image` dinámica
- **Severidad**: ALTO
- **Ubicaciones**:
  - [apps/barraca/src/app/producto/[slug]/page.tsx:47-80](apps/barraca/src/app/producto/[slug]/page.tsx#L47) — `generateMetadata` sin `openGraph.images`
  - [apps/constructora/src/app/maquinarias/[id]/page.tsx](apps/constructora/src/app/maquinarias/[id]/page.tsx) — verificar mismo patrón
- **Recomendación**: en `generateMetadata`, leer `producto.imagen` / `machine.imagen` y emitir `images: [{url, width:1200, height:630, alt: producto.nombre}]`.

#### 🟡 S-3 — `openGraph.siteName` divergente dentro de constructora
- **Severidad**: MEDIO
- **Ubicaciones**:
  - [apps/constructora/src/app/layout.tsx:147](apps/constructora/src/app/layout.tsx#L147) → `siteName: "JURMAQ"`
  - [apps/constructora/src/app/page.tsx:70](apps/constructora/src/app/page.tsx#L70) → `siteName: "JURMAQ.cl"` ❌
- **Recomendación**: estandarizar a `"JURMAQ"` en todas las pages; remover override `.cl`.

#### 🟡 S-4 — `keywords` en layout sólo en constructora
- **Severidad**: MEDIO (low SEO impact, alto signal de strategy)
- **Ubicaciones**:
  - Constructora: 71 keywords en `layout.tsx:66-136`
  - Barraca: sin keywords en `layout.tsx` (sólo en algunas child pages)
- **Recomendación**: agregar bloque de keywords a `apps/barraca/src/app/layout.tsx` por paridad.

#### 🟡 S-5 — JSON-LD: horarios de atención divergentes
- **Severidad**: MEDIO
- **Encontrado**:
  - Barraca `openingHoursSpecification.closes`: `"18:00"`
  - Constructora `openingHoursSpecification.closes`: `"18:30"`
- **Recomendación**: verificar horario real y alinear; afecta Google Knowledge Panel.

#### 🟢 S-6 — `host` incorrecto en barraca/robots.ts
- **Severidad**: BAJO (deprecated por Google pero leído por bots menores)
- **Ubicaciones**:
  - [apps/barraca/src/app/robots.ts](apps/barraca/src/app/robots.ts) → `host: "https://jurmaq.cl"` ❌
- **Recomendación**: cambiar a `"https://barraca.jurmaq.cl"`.

#### ✅ S-7 — Fix `"%s | JURMAQ" → "%s"` confirmado sin regresión
- Ambos layouts usan `template: "%s"` correctamente. Sin acción necesaria.

---

### 2.4 Terminología & copy

#### 🟡 C-1 — "cotización" vs "cotizacion" (sin tilde)
- **Severidad**: MEDIO (profesionalismo)
- **Conteo**: con tilde 41 / sin tilde 52
- **Ubicaciones (muestra sin tilde)**:
  - [apps/barraca/src/lib/email-sequences.ts:156](apps/barraca/src/lib/email-sequences.ts#L156)
  - [apps/constructora/src/lib/email-queue.ts](apps/constructora/src/lib/email-queue.ts)
  - [apps/constructora/src/app/api/cotizaciones/[id]/route.ts](apps/constructora/src/app/api/cotizaciones/[id]/route.ts)
- **Recomendación**: find-and-replace cuidadoso (excluir nombres de tabla/columna SQL donde la tilde puede romper queries).

#### 🟠 C-2 — CTAs de WhatsApp con `text=` hardcodeado en 15+ ubicaciones
- **Severidad**: ALTO
- **Ubicaciones (muestra)**:
  - [apps/barraca/src/app/page.tsx](apps/barraca/src/app/page.tsx) → "Hola, necesito cotizar materiales"
  - [apps/barraca/src/components/barraca/BarracaShell.tsx](apps/barraca/src/components/barraca/BarracaShell.tsx) → "Hola, necesito cotizar productos de la barraca"
  - [apps/barraca/src/app/producto/[slug]/AddToCartClient.tsx](apps/barraca/src/app/producto/[slug]/AddToCartClient.tsx) → "Hola, quiero cotizar: {producto.nombre} (x{cantidad})"
  - [apps/barraca/src/app/maestros/page.tsx](apps/barraca/src/app/maestros/page.tsx) → "Hola, quiero registrarme como maestro de JURMAQ"
  - [apps/constructora/src/app/obras-completas/page.tsx](apps/constructora/src/app/obras-completas/page.tsx) → 2 variantes ("precio personalizado" / "precio de obra completa")
  - [apps/barraca/src/app/api/cotizaciones/[id]/message/route.ts](apps/barraca/src/app/api/cotizaciones/[id]/message/route.ts) → "Hola, consulto por mi cotizacion #{numero}"
- **Recomendación**: crear `packages/shared/src/whatsapp.ts` con `buildWhatsAppText(type: 'cotizar' | 'maestro' | 'obra' | 'consulta', context?)` y reemplazar en todos los call sites.

#### 🟢 C-3 — Microcopy de error inconsistente
- Mezcla de "Error al X" genéricos vs "No pudimos X — intenta de nuevo" accionables.
- **Recomendación**: centralizar en `packages/shared/src/messages.ts` con constantes (`TOAST_MESSAGES`).

#### 🟢 C-4 — Footer copyright: variante con/sin "Todos los derechos reservados"
- Barraca [BarracaShell.tsx:699](apps/barraca/src/components/barraca/BarracaShell.tsx#L699): incluye `"…Todos los derechos reservados"`
- Constructora [Footer.tsx:107](apps/constructora/src/components/public/Footer.tsx#L107): sin esa frase
- **Recomendación**: unificar y extraer a helper `buildFooterCopyright(brand)`.

---

### 2.5 Imágenes & assets

#### ✅ I-1 — Paths `/images/` validados, sin 404
- 33 archivos en `/images/barraca/categorias/`, 9 en `/images/maquinarias/`, 6 en `/images/clientes/` (incluye `valdivieso.png` ✓ — el untracked está en disco).
- Sin acción necesaria.

#### 🟢 I-2 — Alt text genérico ocasional
- Mayoría usa `alt={nombre}` ✓ — revisar si hay imágenes decorativas con `alt="imagen"` (debería ser `alt=""`).

---

### 2.6 Información legal fragmentada (RUT, dirección, email)

#### 🟠 L-5 — Dos direcciones reales mezcladas en templates
- **Severidad**: ALTO
- **Direcciones canonical**:
  - **Barraca (Molina)**: `Av. Poniente 2157, Molina, Maule`
  - **Constructora HQ (Curicó)**: `LT 3 DEL LT A HJ 11, Maquehua, Curicó`
- **Problema**: templates de arriendo usan dirección de barraca:
  - [packages/shared/src/mail/templates/admin-manual-arriendo.ts:142](packages/shared/src/mail/templates/admin-manual-arriendo.ts#L142) → "Av. Poniente" ❌ (debería ser HQ Maquehua porque es arriendo)
  - [apps/constructora/src/components/public/Footer.tsx:73](apps/constructora/src/components/public/Footer.tsx#L73) → "Camino a Molina, Curicó" (vago)
- **Recomendación**: crear `LEGAL_INFO.HQ_CONSTRUCTORA` y `LEGAL_INFO.BARRACA_MOLINA` separados; usar el correcto según contexto del template.

#### 🟡 L-6 — `constructora@jurmaq.cl` no documentado
- **Severidad**: MEDIO
- **Ubicaciones**:
  - [packages/shared/src/mail/transport.ts:25](packages/shared/src/mail/transport.ts#L25) → `${ADMIN_EMAIL || 'contacto@jurmaq.cl'},constructora@jurmaq.cl`
- **Recomendación**: si es permanente, agregar a `LEGAL_INFO.emails` como `constructora_admin`.

#### ✅ L-RUT — RUT consistente
- `76.624.872-1` no diverge en ninguna ubicación. Sin acción necesaria.

---

### 2.7 Patrones técnicos

#### 🟠 T-1 — `globals.css` divergente entre apps
- **Severidad**: ALTO
- **Ubicaciones**:
  - [apps/barraca/src/app/globals.css](apps/barraca/src/app/globals.css) — versión minimalista
  - [apps/constructora/src/app/globals.css](apps/constructora/src/app/globals.css) — versión extendida con ~70 líneas de utilities (`.editorial-h1`, `.eyebrow`, `.tabular-nums`, `.reveal-on-load`, `.hairline`, `.shadow-diffuse`, `.transition-spring`, `.tactile`, `@keyframes reveal-up`, etc.) que NO existen en barraca
  - Barraca: referencias a `Inter` (deprecated); constructora: usa `var(--font-sans)` ✓
- **Impacto**: trampa de "funciona en constructora, falla en barraca" cuando se intente compartir componentes.
- **Recomendación**: extraer base común a `packages/ui/globals.css` (o `packages/shared/styles/globals.css`); cada app importa + override mínimo.

#### 🟡 T-2 — 7 componentes duplicados cross-app
- **Severidad**: MEDIO
- **Pares duplicados (mismo nombre, código casi idéntico)**:
  - `Analytics.tsx` (90% idéntico — barraca 58 líneas, constructora 44)
  - `CookieBanner.tsx` (lógica idéntica; diferencias en colores hex `#111111` vs `#081428` y comentarios)
  - `admin/AdminShell.tsx`
  - `admin/SessionWrapper.tsx`
  - `admin/NotificationsBell.tsx`
  - `analytics/ViewItemTracker.tsx`
  - `WhatsappLink.tsx`
- **Riesgo**: cambios en uno se pierden en el otro (ya pasó con CookieBanner colors).
- **Recomendación**: extraer prioritariamente `Analytics`, `CookieBanner`, `ViewItemTracker` (consent/tracking — alto riesgo) a `packages/ui/` con tema configurable por prop.

#### 🟢 T-3 — `"use client"` vs `'use client'` (comillas inconsistentes)
- **Severidad**: BAJO (no funcional)
- **Recomendación**: estandarizar a `"use client"` (double quotes); pasada con `rg --files-with-matches "^'use client'" apps/ | xargs sed -i ''`.

#### ✅ T-4 — Sin imports cruzados entre apps
- Sin acción necesaria.

#### ✅ T-5 — Versiones de deps idénticas
- Misma `next@16.2.6`, `react@19.2.6`, `next-auth@5.0.0-beta.31`, etc. Sin acción.

#### ✅ T-6 — `console.*` controlados (no debug olvidados)
- 303 logs, todos con prefijo estructurado (`[cot-arriendo-ok]`, `[auth-event-signIn]`, `[email-send-ok]`). Sin acción inmediata.

---

### 2.8 Categorías nuevas detectadas (no en plan original)

#### 🟡 X-1 — 99 ocurrencias de `: any` (Supabase rows sin tipos generados)
- **Severidad**: MEDIO
- **Concentrado en**:
  - [apps/barraca/src/app/page.tsx](apps/barraca/src/app/page.tsx) (~12 any en map de productos)
  - [apps/barraca/src/app/admin/importar/page.tsx](apps/barraca/src/app/admin/importar/page.tsx) (parsing Excel)
  - [apps/constructora/src/app/admin/contratos/](apps/constructora/src/app/admin/contratos/) (contract handling)
- **Recomendación**: generar tipos con `supabase gen types typescript --project-id … > packages/shared/src/db-types.ts` y reemplazar `(row: any)` con `(row: Database['public']['Tables']['productos']['Row'])`.

#### 🟡 X-2 — Sin schema de env vars
- **Severidad**: MEDIO
- **Encontrado**: 30+ accesos directos a `process.env.*` sin validación centralizada (no hay `env.ts` con Zod/t3).
- **Recomendación**: crear `packages/shared/src/env.ts` con esquema Zod y exportar `env` validado; reemplazar `process.env.X` por `env.X`.

#### 🟢 T-EXP — `@ts-expect-error` en middleware (intencional)
- 2 ocurrencias en `apps/*/src/middleware.ts` — compatibilidad NextAuth, bien documentado. Mantener.

---

## 3. Plan de Remediación

> Cada bloque es un commit/PR independiente. Orden recomendado: ejecutar de arriba a abajo. Los bloques 🔴 deben hacerse en la próxima sesión.

---

### 🔴 Bloque CRÍTICO-1 — Auditar y centralizar todos los teléfonos
**Esfuerzo**: ~30 min · **PR único**

**Objetivo**: que el único número de WhatsApp/teléfono que aparezca en código sea importado desde `LEGAL_INFO`.

**Pasos**:
1. Decidir con el dueño del negocio si `+56 9 9299 4452` (footer constructora) es un número real válido. Si sí, agregar a `LEGAL_INFO` como `HQ_CONSTRUCTORA.telefono`; si no, eliminarlo.
2. Agregar `LEGAL_INFO.maestros_whatsapp = '+56983221440'` a [packages/shared/seo/index.ts](packages/shared/seo/index.ts).
3. Reemplazar hardcodes:
   - [apps/constructora/src/components/public/Footer.tsx:64-65](apps/constructora/src/components/public/Footer.tsx#L64) → `LEGAL_INFO.HQ_CONSTRUCTORA.telefono` (o canonical)
   - [packages/shared/src/mail/templates/admin-manual-arriendo.ts:53-54](packages/shared/src/mail/templates/admin-manual-arriendo.ts#L53) → `LEGAL_INFO.maestros_whatsapp`
   - [apps/barraca/src/app/maestros/[codigo]/page.tsx:146](apps/barraca/src/app/maestros/[codigo]/page.tsx#L146) → idem
4. Eliminar placeholders `+56912345678` en [cotizacion-arriendo.ts:116](packages/shared/src/mail/templates/cotizacion-arriendo.ts#L116) y [pago/error/page.tsx:61](apps/barraca/src/app/pago/error/page.tsx#L61) (verificar antes si están en uso real).

**Validación post-fix**:
- `rg "\+56\s*9\s*\d{4}\s*\d{4}" apps/ packages/` → debe retornar 0 resultados fuera de `LEGAL_INFO`.

---

### 🔴 Bloque CRÍTICO-2 — Separar direcciones legales por unidad de negocio
**Esfuerzo**: ~20 min · **PR único**

**Objetivo**: clarificar que barraca opera en Molina y constructora en Maquehua/Curicó; ningún template debe mezclarlas.

**Pasos**:
1. En [packages/shared/seo/index.ts](packages/shared/seo/index.ts), reemplazar `LEGAL_INFO.direccion` único por:
   ```ts
   LEGAL_INFO.HQ_CONSTRUCTORA = { direccion: 'LT 3 DEL LT A HJ 11, Maquehua, Curicó', ciudad: 'Curicó', region: 'Maule' };
   LEGAL_INFO.BARRACA_MOLINA  = { direccion: 'Av. Poniente 2157, Molina', ciudad: 'Molina', region: 'Maule' };
   ```
2. Auditar y corregir cada uso según contexto:
   - Templates de arriendo (constructora) → `HQ_CONSTRUCTORA`
   - Templates/footer de barraca → `BARRACA_MOLINA`
   - Footer constructora ([Footer.tsx:73](apps/constructora/src/components/public/Footer.tsx#L73) "Camino a Molina, Curicó") → reemplazar con dirección completa.
3. Verificar JSON-LD `LocalBusiness.address` en ambos `layout.tsx`.

**Validación post-fix**: `git diff` debe mostrar que cada uso de dirección importa la constante adecuada.

---

### 🔴 Bloque CRÍTICO-3 — Auditar nombres legales en PDFs y T&C
**Esfuerzo**: ~15 min · **PR único**

**Objetivo**: eliminar el híbrido `JURMAQ E.I.R.L.` y formalizar la distinción razón social / nombre comercial.

**Pasos**:
1. Agregar a `LEGAL_INFO`:
   ```ts
   LEGAL_INFO.nombreComercial = 'JURMAQ';
   LEGAL_INFO.nombreLegal = 'Constructora Jorge Ubilla Rivera E.I.R.L.';
   ```
2. Corregir [apps/barraca/src/app/api/cotizaciones/[id]/pdf/route.ts:574](apps/barraca/src/app/api/cotizaciones/[id]/pdf/route.ts#L574) → `LEGAL_INFO.nombreLegal`.
3. Documentar en `packages/shared/seo/index.ts` con comentario JSDoc cuándo usar cada uno.

**Validación**: `rg "JURMAQ E\.I\.R\.L\." apps/ packages/` → 0 resultados.

---

### 🟠 Bloque ALTO-1 — OpenGraph images + siteName consistente
**Esfuerzo**: ~45 min · **PR único**

**Objetivo**: que cada share en RRSS muestre miniatura visual correcta.

**Pasos**:
1. Crear `/apps/constructora/public/og-image-1200x630.png` (1200×630, marca + hero).
2. Agregar a [apps/constructora/src/app/layout.tsx](apps/constructora/src/app/layout.tsx):
   ```ts
   openGraph: {
     images: [{ url: 'https://jurmaq.cl/og-image-1200x630.png', width: 1200, height: 630, alt: 'JURMAQ' }],
     siteName: 'JURMAQ',
   }
   ```
3. Remover override `siteName: "JURMAQ.cl"` de [page.tsx:70](apps/constructora/src/app/page.tsx#L70) → heredar del layout.
4. En [apps/barraca/src/app/producto/[slug]/page.tsx:47-80](apps/barraca/src/app/producto/[slug]/page.tsx#L47) (y maquinarias/[id] equivalente en constructora), agregar a `generateMetadata`:
   ```ts
   openGraph: {
     images: [{ url: producto.imagen || '/og-default-1200x630.png', width: 1200, height: 630, alt: producto.nombre }]
   }
   ```

**Validación**: usar [opengraph.xyz](https://www.opengraph.xyz/) o `curl` con `?_escaped_fragment_=` y verificar `<meta property="og:image">` en cada page.

---

### 🟠 Bloque ALTO-2 — Helper `buildWhatsAppText()` centralizado
**Esfuerzo**: ~30 min · **PR único**

**Objetivo**: una sola fuente de texto para todos los CTA de WhatsApp.

**Pasos**:
1. Crear [packages/shared/src/whatsapp.ts](packages/shared/src/whatsapp.ts):
   ```ts
   type WAType = 'cotizar-materiales' | 'cotizar-producto' | 'maestro' | 'obra-completa' | 'consulta-cotizacion';
   export function buildWhatsAppUrl(type: WAType, ctx?: Record<string, string>): string { … }
   ```
2. Reemplazar los 15+ hardcodes (lista en hallazgo C-2).
3. Saludo canonical: `"Hola, "` (con coma + espacio).

**Validación**: `rg "wa\.me/.*text=" apps/` → todos los matches deben venir del helper.

---

### 🟠 Bloque ALTO-3 — Unificar `globals.css` en `packages/ui/`
**Esfuerzo**: ~45 min · **PR único**

**Objetivo**: que las 70 utilities de constructora también vivan en barraca, sin duplicar.

**Pasos**:
1. Crear `packages/ui/styles/globals.css` con la versión consolidada (tomar como base la de constructora, eliminar refs deprecated a Inter).
2. En cada app, `apps/<app>/src/app/globals.css` reduce a:
   ```css
   @import "@jurmaq/ui/styles/globals.css";
   /* overrides específicos del app */
   ```
3. Verificar en build que Tailwind layer ordering (`@layer base/components/utilities`) se mantiene.

**Validación**: `next build` en ambas apps sin warnings de CSS; spot-check visual de utilities `.editorial-h1` y `.tabular-nums` ahora funcionando en barraca.

---

### 🟠 Bloque ALTO-4 — Extraer componentes duplicados a `packages/ui`
**Esfuerzo**: ~60 min · **PR único** (puede dividirse en sub-PRs)

**Objetivo**: una sola implementación de `Analytics`, `CookieBanner`, `ViewItemTracker`.

**Pasos** (priorizar consent/tracking — alto riesgo de divergencia legal):
1. Crear `packages/ui/components/Analytics.tsx` parametrizado por `gaId`, `metaPixelId`, `consentVersion`.
2. Crear `packages/ui/components/CookieBanner.tsx` parametrizado por `theme: { bgColor, textColor }`.
3. Crear `packages/ui/components/analytics/ViewItemTracker.tsx` parametrizado.
4. Borrar versiones duplicadas en ambas apps; importar desde `@jurmaq/ui`.
5. Diferir `admin/AdminShell`, `admin/SessionWrapper`, `admin/NotificationsBell`, `WhatsappLink` a una segunda iteración (no son user-facing).

**Validación**: `find apps -name 'CookieBanner.tsx' -not -path '*/node_modules/*'` → 0 resultados.

---

### 🟡 Bloque MEDIO-1 — Estandarizar "cotización" (con tilde)
**Esfuerzo**: ~20 min · **PR único**

**Pasos**:
1. `rg -l "cotizacion" apps/ packages/ -g '!*.sql' -g '!*.json'` → lista de archivos.
2. Reemplazo manual archivo por archivo (NO `sed -i` masivo — algunos pueden ser identificadores válidos o nombres de tabla).
3. Excluir explícitamente: nombres de columnas/tablas Supabase, identificadores de rutas (`/api/cotizaciones/`), variables de código (`numeroCotizacion`).

**Validación**: `rg "cotizacion" apps/ packages/ -g '!*.sql' -g '!*.json' -g '!api/cotizaciones'` → resultados sólo en identificadores técnicos justificados.

---

### 🟡 Bloque MEDIO-2 — JSON-LD: alinear horarios + agregar a barraca/layout
**Esfuerzo**: ~25 min · **PR único**

**Pasos**:
1. Confirmar con el dueño del negocio el horario real (¿18:00 o 18:30?). Actualizar ambos.
2. Mover el bloque JSON-LD `Organization + LocalBusiness + WebSite` de constructora ([layout.tsx:216-307](apps/constructora/src/app/layout.tsx#L216)) a un helper en `packages/shared/seo/jsonld.ts` parametrizado por brand.
3. Llamar desde ambos `layout.tsx`.

**Validación**: [Google Rich Results Test](https://search.google.com/test/rich-results) sobre ambos dominios.

---

### 🟡 Bloque MEDIO-3 — Schema de env vars con Zod
**Esfuerzo**: ~45 min · **PR único**

**Pasos**:
1. Crear [packages/shared/src/env.ts](packages/shared/src/env.ts) con Zod schema (`NEXTAUTH_SECRET`, `SUPABASE_URL`, `RESEND_API_KEY`, etc.).
2. Exportar `env` validado en runtime.
3. Reemplazar `process.env.X` → `env.X` en los ~30 call sites.

**Validación**: build con env incompleta debe fallar con error explícito de Zod.

---

### 🟡 Bloque MEDIO-4 — Tipos Supabase generados
**Esfuerzo**: ~60 min · **PR único**

**Pasos**:
1. `supabase gen types typescript --project-id <id> > packages/shared/src/db-types.ts`
2. Reemplazar `(row: any)` por `(row: Database['public']['Tables']['<tabla>']['Row'])` en los ~99 sitios.
3. Agregar script `pnpm db:types` al root `package.json` para regenerar.

**Validación**: `rg ": any" apps/ packages/ --type ts` → reducción >80%.

---

### 🟢 Bloque BAJO-1 — Microcopy + footer copyright + comillas use client
**Esfuerzo**: ~30 min · **PR único** (cleanup mixto)

**Pasos**:
1. Crear `packages/shared/src/messages.ts` con `TOAST_MESSAGES = { ADD_TO_CART_SUCCESS, ADD_TO_CART_ERROR, ... }`.
2. Reemplazar strings inline de toasts/alerts.
3. Crear `buildFooterCopyright(brand)` y unificar barraca/constructora.
4. Pasar `apps/ -g '*.tsx'` y normalizar `'use client'` → `"use client"`.
5. Corregir [barraca/robots.ts](apps/barraca/src/app/robots.ts) `host: "https://barraca.jurmaq.cl"`.
6. Agregar `keywords` en [barraca/layout.tsx](apps/barraca/src/app/layout.tsx).

**Validación**: spot-check visual de toasts en dev.

---

## 4. Apéndice

### 4.1 Archivos críticos auditados

- `packages/shared/seo/index.ts` (fuente canonical)
- `apps/{barraca,constructora}/src/app/layout.tsx` (metadata raíz)
- `apps/{barraca,constructora}/src/app/page.tsx` (landing)
- `apps/{barraca,constructora}/src/app/robots.ts`, `sitemap.ts`
- `apps/{barraca,constructora}/src/app/globals.css`
- `apps/barraca/src/components/barraca/BarracaShell.tsx`
- `apps/constructora/src/components/public/Footer.tsx`
- `apps/barraca/src/app/api/cotizaciones/[id]/pdf/route.ts`
- `packages/shared/src/mail/templates/*` (admin-manual-arriendo, cotizacion-arriendo)
- `apps/barraca/src/app/producto/[slug]/page.tsx`, `apps/constructora/src/app/maquinarias/[id]/page.tsx`
- Untracked verificados: `FleteCalculator.tsx`, `FleteCardSyncer.tsx`, `flete-pricing.ts`, `api/flete-cotizar/`, `valdivieso.png` — sin nuevas inconsistencias detectadas en estos (siguen convenciones existentes).

### 4.2 Patrones de búsqueda usados

```bash
# Teléfonos / WhatsApp
rg -n "\+56" apps/ packages/
rg -n "wa\.me/" apps/ packages/
rg -n "tel:" apps/ packages/

# Nombres legales
rg -n "JURMAQ|Barraca|Constructora" apps/ packages/
rg -n "E\.I\.R\.L\." apps/ packages/

# RUT
rg -n "76\.624" apps/ packages/

# Email
rg -n "@jurmaq\.cl" apps/ packages/
rg -n "mailto:" apps/ packages/

# SEO
rg -n "export const metadata|export async function generateMetadata" apps/
rg -n "application/ld\+json|@type" apps/

# Copy variants
rg -n -i "cotización|cotizacion" apps/ packages/
rg -n -i "maquinaria|máquina" apps/

# Imágenes
rg -n "/images/" apps/ packages/

# Patrones técnicos
rg -l "useState|useEffect|onClick" apps/ -g '*.tsx'
rg -n ": any\b" apps/ packages/
rg -n "process\.env\." apps/ packages/
```

### 4.3 Falsos positivos descartados

- **Números `+56 9 1234 5678` en form placeholders HTML** (3 ubicaciones): no se envían al usuario, son sólo hint visual.
- **Números `+56912345678` en comentarios JSDoc** (2 ubicaciones en `packages/shared/src/logging/index.ts` y `otp/providers/openwa-provider.ts`): ejemplos de documentación.
- **Mezcla `"use client"` / `'use client'`**: ambas válidas en JS; flagged como BAJO por consistencia, no por bug.
- **`@ts-expect-error` en middleware NextAuth**: intencional y documentado.
- **303 `console.*`**: estructurados con prefijos `[event-name]`; son audit logs, no debug olvidados.

### 4.4 Aspectos verificados sin hallazgos

- ✅ Fix del template `"%s | JURMAQ" → "%s"` (no hay regresión)
- ✅ Sin imports cruzados barraca ↔ constructora
- ✅ Todas las imágenes `/images/` existen en `/public/`
- ✅ Versiones de `next`, `react`, `next-auth`, `@supabase/*` idénticas entre apps
- ✅ Todos los componentes con hooks tienen `"use client"` correctamente
- ✅ Sitemaps bien implementados (`MetadataRoute.Sitemap`)
- ✅ Alt text en imágenes críticas
- ✅ RUT `76.624.872-1` consistente en todas las ubicaciones

---

**Fin del reporte.** Para implementar bloques específicos, abrir nueva sesión y pedir: *"ejecuta Bloque CRÍTICO-1 del reporte de auditoría"*.
