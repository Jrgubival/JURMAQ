# SEO Master Plan — JURMAQ.CL Monorepo

**Fecha**: 2026-05-27
**Alcance**: `apps/constructora` (jurmaq.cl) + `apps/barraca` (barraca.jurmaq.cl)
**Framework**: Skills `seo`, `seo-audit`, `programmatic-seo`, `core-web-vitals`
**Estado base**: Fundación SEO sólida — sitemaps dinámicos, JSON-LD compartido, OG images 1200×630, sitemap con 180+ landings programáticas. Hay quick-wins de alto impacto y oportunidades de programmatic-SEO sin tocar.

---

## 1. Resumen ejecutivo

JURMAQ.CL llega con una base técnica **mucho más madura que el promedio del sector**: helpers compartidos en `packages/shared/src/seo/`, sitemaps que ya generan ~280 URLs únicas (84 ciudad×tipo en constructora + 96 material×ciudad en barraca + productos + categorías + guías + competidores), JSON-LD con `Organization` + `LocalBusiness/HardwareStore` + `WebSite` + `Product` + `ItemList` + `BreadcrumbList`, y robots.txt que permite explícitamente bots de IA (OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended).

Pero hay **fugas de SEO técnico evitables** y **oportunidades programáticas grandes que están al alcance**:

### Top 5 wins de mayor impacto

1. 🔴 **`<img>` directos en lugar de `next/image` en cards de productos y máquinas** — la home de barraca, la grilla de productos, y la grilla de maquinarias usan `<img>` puro. Pierde AVIF/WebP automático, srcset responsive y degrada LCP en mobile (donde probablemente es el LCP element). Fix de baja complejidad, ganancia directa en Core Web Vitals.

2. 🔴 **Verificación de Google Search Console + Bing Webmaster faltan** — sin meta tag `google-site-verification` ni `msvalidate.01` en ninguno de los dos layouts. Sin Search Console no podemos diagnosticar indexación, errores de crawl, ni keywords reales. Es el primer paso obligatorio para todo lo demás.

3. 🟡 **Programmatic SEO faltante: `/maquinarias/[slug]/en/[ciudad]`** — ya tenemos `/arriendo-en/[ciudad]/[tipo]` (genérico, ej. "miniexcavadora en talca") pero NO el detalle máquina-específica por ciudad ("xcmg-xe35u-arriendo-talca"). Con la flota actual de ~20 máquinas × 12 ciudades = ~240 landings adicionales, todas con long-tail intent comercial alto.

4. 🟡 **Sin blog / recursos / guías en constructora** — barraca ya tiene `/guias/[slug]` con FAQ schema, pero constructora no tiene equivalente. Es la oportunidad informacional grande del sector: "cómo elegir minicargador", "diferencia entre retroexcavadora y miniexcavadora", "cálculo de m3 de excavación", "checklist arriendo maquinaria con operador", etc. — keywords donde la competencia local NO está y donde el AI search (Perplexity, ChatGPT search) prefiere extraer.

5. 🟡 **Inconsistencias barraca vs constructora en root layout** — barraca NO tiene `<head>` con preconnects ni Speculation Rules; constructora sí. Y la home de barraca duplica JSON-LD HardwareStore (uno en layout via `buildJsonLdGraph('barraca')`, otro hard-coded en `page.tsx:282`). Fixes simples que normalizan calidad técnica entre apps.

### Diagnóstico general

| Dimensión | Estado | Comentario |
|-----------|--------|------------|
| Crawlability | ✅ Excelente | robots.ts y sitemap.ts dinámicos en ambas apps, AI bots permitidos |
| Indexability | 🟡 Buena | Falta `noindex` en `/cuenta/login` y `/cuenta/registro`; faltan verificaciones GSC/Bing |
| Metadata | 🟡 Buena | Todas las pages tienen `metadata`; titles ligeramente largos (>60 chars) en home y maquinarias |
| Structured data | ✅ Muy buena | JSON-LD compartido + esquemas específicos por page; algunos duplicados |
| Programmatic SEO | 🟡 Buena | Excelente cobertura ciudad×tipo; falta máquina×ciudad y categoría×ciudad |
| Performance / CWV | 🟡 Buena | Bien configurado (`next/font swap`, AVIF/WebP, `content-visibility`, Speculation Rules en constructora), pero `<img>` sueltos en cards degradan LCP |
| Internal linking | 🟡 Buena | CrossLinksGrid existe en constructora; falta en barraca; sin breadcrumbs visibles uniformes |
| Content depth | 🔴 Inconsistente | Barraca tiene calculadoras + guías; constructora no tiene blog/recursos |
| Off-page | ⚠️ No medible desde código | Backlinks, GBP, reviews externos — fuera del scope técnico |
| Analytics | 🟡 Buena | GA4 + eventos custom (`add_to_cart`, `mejora_precio_upload`, etc.); falta GSC + Search Console |

---

## 2. Issues clasificados

### 🔴 CRÍTICO — Bloquean rankings o pérdida medible inmediata

| # | Issue | Páginas afectadas | Impacto | Esfuerzo |
|---|-------|-------------------|---------|----------|
| C1 | **Sin verificación GSC ni Bing Webmaster** | Layouts root de ambas apps | Bloquea diagnóstico de indexación, queries reales, sitemap submission | 30 min |
| C2 | **`<img>` directos en cards de productos y máquinas** | `apps/barraca/src/app/page.tsx` (mobile categorías y producto cards via ProductCard), `apps/constructora/src/app/page.tsx` (featured machines), `apps/constructora/src/app/maquinarias/page.tsx` (grid completa) | Pierde AVIF/WebP, srcset, lazy loading óptimo. Degrada LCP mobile en grilla de catalog | 2-3h |
| C3 | **`/cuenta/login` y `/cuenta/registro` sin `robots: { index: false }`** | `apps/*/src/app/cuenta/login/page.tsx`, `apps/barraca/src/app/cuenta/registro/page.tsx` | Riesgo de indexar páginas de auth (mala UX en SERPs, posibles snippets sensibles) | 15 min |
| C4 | **JSON-LD HardwareStore duplicado en barraca home** | `apps/barraca/src/app/page.tsx:282-354` duplica el schema que ya inyecta `apps/barraca/src/app/layout.tsx:160-165` via `buildJsonLdGraph('barraca')` | Google podría leer schemas conflictivos (`@id` distintos pero mismo tipo, mismas props) — error "Duplicate structured data" en Rich Results Test | 30 min |
| C5 | **Titles >60 chars en home y listing** | `apps/constructora/src/app/page.tsx:18` ("JURMAQ · Arriendo Retroexcavadora, Minicargador y Maquinaria en Curicó" = 73 chars), `apps/barraca/src/app/page.tsx:48` ("Barraca de Fierros JURMAQ · Materiales de Construcción en Curicó y Molina" = 75 chars), `apps/constructora/src/app/maquinarias/page.tsx:19` (78 chars) | Google trunca a ~60 chars en SERP, perdiendo el final donde van las geos. Mobile aún más restrictivo | 30 min |

### 🟡 ALTO — Oportunidades grandes con esfuerzo moderado

| # | Issue | Páginas afectadas | Impacto | Esfuerzo |
|---|-------|-------------------|---------|----------|
| A1 | **Programmatic SEO: `/maquinarias/[slug]/en/[ciudad]`** — landings máquina-específica × ciudad | Nueva ruta dinámica en `apps/constructora/src/app/`; data join `maquinarias.id` × `CIUDADES` | ~240 nuevas landings de long-tail comercial alto. Ej: "arriendo xcmg xe35u en talca" tipo búsquedas específicas de usuarios que ya vieron la máquina en el catálogo | 6-8h |
| A2 | **Blog/recursos en constructora (`/recursos/[slug]` o `/blog/[slug]`)** | Nueva sección en `apps/constructora/src/app/`; estructura similar a `apps/barraca/src/app/guias/` | Captura keywords informacionales sin competencia local; alimenta AI search citations | 8-12h MVP con 6-8 artículos seed |
| A3 | **Inconsistencias barraca layout vs constructora** | `apps/barraca/src/app/layout.tsx` — falta `<head>` con `<meta apple-mobile-web-app-*>`, falta preconnects a Supabase + Unsplash + cdnjs, falta Speculation Rules | Performance mobile (LCP percibido), iOS PWA UX | 1h |
| A4 | **H1 en barraca home está `sr-only`; el "visual H1" es un `<p aria-hidden>`** | `apps/barraca/src/app/page.tsx:378 (H1 oculto)` + `:395 (p visible)` | Para usuarios sighted el H1 efectivo es invisible; el `<p>` no aporta jerarquía a parsers. Google sí lee el `sr-only` pero la dual-source genera ambigüedad | 1-2h refactor |
| A5 | **OG image override en barraca home apunta a icon-512** | `apps/barraca/src/app/page.tsx:130-138` pone `/barraca/icon-512.png` 512×512 como OG image, pisando el `/og-image-barraca-1200x630.png` correcto del layout | Compartidos en WhatsApp/FB/LinkedIn salen con favicon en lugar de OG hero | 15 min |
| A6 | **Link `/barraca` en home constructora redirige via middleware en lugar de linkear directo** | `apps/constructora/src/app/page.tsx:109` (`href: "/barraca"`) → middleware 301 → `barraca.jurmaq.cl` | Hop extra; mejor linkear directo (cross-brand domain change OK). Solo redirige users, no costoso, pero perfectible | 15 min |
| A7 | **Programmatic SEO: `/categorias/[slug]/en/[ciudad]` en barraca** | Nueva sub-ruta en `apps/barraca/src/app/categorias/[slug]/en/[ciudad]/` | Combinaciones categoría × ciudad (~20 categorías × 12 ciudades = 240). Long-tail tipo "fierros construcción en talca" | 6-8h |
| A8 | **Reviews/Testimonios en constructora** | Nueva sección en `apps/constructora/src/app/page.tsx` o `/proyectos` | `Review` + `AggregateRating` schema. Trust signal alto en B2B construcción | 4-6h |
| A9 | **Faltan breadcrumbs visibles uniformes** | `apps/constructora/src/app/maquinarias/[id]/page.tsx`, `apps/barraca/src/app/producto/[slug]/page.tsx`, `apps/barraca/src/app/categorias/[slug]/page.tsx` | Tienen BreadcrumbList JSON-LD pero no UI consistente. Mejora navegación + UX | 2-3h |
| A10 | **CrossLinksGrid no existe en barraca** | `apps/constructora/src/components/public/CrossLinksGrid.tsx` solo se usa en constructora | Replicar el patrón en barraca para `/categorias/[slug]` y `/en/[ciudad]` ayuda internal linking + retención SEO | 2h |
| A11 | **3 imágenes con alt vacío** | `apps/barraca/src/components/barraca/MobileHero.tsx`, `apps/constructora/src/components/animations/HeroSlideshow.tsx`, `apps/barraca/src/app/admin/imagenes-masivas/page.tsx` (admin OK) | Alt vacío en hero es problema A11y + SEO leve | 30 min |
| A12 | **`/proyectos` en constructora existe pero sin detalle individual** | No hay `/proyectos/[slug]` con `Case Study` schema | Las obras (Nestlé, Miguel Torres, Iansagro, Surfrut, etc.) son trust signal masivo. Cada una merece su page con esquema, fotos y resultados | 6-10h por 5-6 case studies |

### 🟢 MEDIO — Optimizaciones que suman

| # | Issue | Páginas afectadas | Impacto |
|---|-------|-------------------|---------|
| M1 | `lang="es"` en constructora (debería ser `es-CL` como barraca) | `apps/constructora/src/app/layout.tsx:208` | Mejor señal de geolocalización idiomática |
| M2 | Robots.ts lista paths legacy `/barraca/cuenta`, `/barraca/carrito`, `/barraca/cotizar` que ya no existen post-split monorepo | `apps/constructora/src/app/robots.ts:7-9` | Limpieza; no rompe pero confunde futuras auditorías |
| M3 | Páginas dinámicas en barraca no tienen `generateStaticParams` (productos, categorías) | `apps/barraca/src/app/producto/[slug]/page.tsx`, `apps/barraca/src/app/categorias/[slug]/page.tsx` | Sin SSG → SSR cada visita. Con ISR (`export const revalidate`) o `generateStaticParams` puntual mejora TTFB |
| M4 | Sitemap barraca usa `changeFrequency: "weekly"` para productos pero `"daily"` para home | `apps/barraca/src/app/sitemap.ts` | Recomendación: productos con stock variable → `daily`. Home → `daily`. Categorías → `weekly` |
| M5 | Falta `<meta name="theme-color">` específico por brand en mobile | Layouts | Constructora `#0c1d3a`, barraca `#081428` ya están en viewport — verificar consistencia con manifest |
| M6 | OG locale `es_CL` correcto pero sin `og:locale:alternate` | Layouts | Si no hay otros idiomas, OK. Documentar |
| M7 | `keywords` meta tag muy largo (50+ keywords) en constructora layout | `apps/constructora/src/app/layout.tsx:70-140` | Meta keywords no se usa para ranking desde 2009, pero un blob enorme se ve spam-y. Reducir a top 15-20 |
| M8 | Falta esquema `Service` separado para Maestranza y Construcción Industrial | Home constructora `OfferCatalog` los lista pero como `Service` genérico | Esquemas dedicados pueden disparar rich results de servicios locales |
| M9 | OG title duplicado en algunos `generateMetadata` que ya hereda del layout | Múltiples pages | Eliminar overrides redundantes |
| M10 | No hay `JURMAQ_SEO` ni `SITE_METADATA` constant compartido | Cada page redefine arrays de keywords | Crear helper compartido reduce drift |
| M11 | No hay sitemap index unificado | Cada app tiene su sitemap.xml separado | Para multi-dominio está OK; Google los procesa via robots.ts sitemap directive |
| M12 | `/maestros/[codigo]` con `priority: 0.5` en sitemap pero estas pages son de bajo SEO intent (referral del maestro) | `apps/barraca/src/app/sitemap.ts:182` | Considerar `noindex` o `priority: 0.3` |
| M13 | `hasOfferCatalog` en JSON-LD home barraca usa categorías reales pero `numberOfItems` no se valida vs DB | `apps/barraca/src/app/page.tsx:340-349` | Si una categoría tiene 0 productos activos, el schema queda desincronizado |

### 🔵 BAJO — Nice-to-haves

| # | Issue |
|---|-------|
| B1 | `llms.txt` en root de cada app (adopción <1%, experimental) |
| B2 | `humans.txt` |
| B3 | Más `sameAs` en Organization JSON-LD (Facebook, LinkedIn, YouTube si existen) |
| B4 | Pretty URLs en cotizaciones públicas (`/cotizacion/[numero]` ya es OK) |
| B5 | `<link rel="alternate" type="application/rss+xml">` cuando exista blog |
| B6 | Mover `keywords` largos del layout a archivos JSON estáticos para reducir bundle size |
| B7 | Validar JSON-LD generado en runtime con tests automatizados (Schema.org Validator API) |

#### Estado de aplicación BAJO (chip 2026-05-27)

- ✅ **B1 aplicado** — `apps/constructora/public/llms.txt` + `apps/barraca/public/llms.txt` creados.
- ✅ **B2 aplicado** — `apps/constructora/public/humans.txt` + `apps/barraca/public/humans.txt` creados.
- ⚠️ **B3 verificado, sin cambio** — WebSearch no encontró Facebook page, LinkedIn company, YouTube ni TikTok para JURMAQ (solo aparece un perfil personal de empleado). `sameAs` queda con solo Instagram. Re-evaluar si se crean redes nuevas en el futuro.
- ⏸️ **B5 omitido** — depende de A2 (`/recursos` en constructora). TODO: cuando A2 corra, crear `apps/constructora/src/app/recursos/feed.xml/route.ts` con el formato RSS sugerido y agregar `<link rel="alternate" type="application/rss+xml">` al layout de constructora.
- ⏸️ **B6 omitido** — compite con M7 (reducir keywords meta a top 15-20). Si M7 corre primero, B6 (mover keywords a JSON) deja de tener sentido. Re-evaluar tras M7.
- ⏸️ **B7 diferido** — overhead alto para ganancia baja. TODO: integrar Schema.org Validator API en CI cuando haya pipeline de tests E2E corriendo (no agregar test runtime ahora).

---

## 3. Tabla de keywords objetivo

Top 30 keywords ranqueadas por intención + volumen estimado (Maule region; volumen relativo basado en WebSearch resultados y patrones de búsqueda local).

### Constructora (jurmaq.cl)

| # | Keyword | Volumen est. | Dificultad | Intent | Page objetivo |
|---|---------|--------------|------------|--------|---------------|
| 1 | arriendo retroexcavadora curicó | Alto | Media | Comercial | `/arriendo-en/curico/retroexcavadora` |
| 2 | arriendo maquinaria curicó | Alto | Media | Comercial | `/arriendo-en/curico` |
| 3 | arriendo retroexcavadora talca | Alto | Media | Comercial | `/arriendo-en/talca/retroexcavadora` |
| 4 | arriendo minicargador curicó | Medio | Baja | Comercial | `/arriendo-en/curico/minicargador` |
| 5 | arriendo miniexcavadora maule | Medio | Baja | Comercial | `/arriendo/miniexcavadora` + city landings |
| 6 | arriendo maquinaria molina | Medio | Baja | Comercial | `/arriendo-en/molina` |
| 7 | constructora curicó | Alto | Alta | Navegacional/comercial | `/` (home) |
| 8 | arriendo brazo articulado curicó | Bajo-medio | Baja | Comercial | `/arriendo-en/curico/brazo-articulado` |
| 9 | arriendo plataforma elevadora curicó | Bajo-medio | Baja | Comercial | `/arriendo-en/curico/plataforma-elevadora` |
| 10 | arriendo retroexcavadora con operador maule | Medio | Baja | Comercial | `/arriendo/retroexcavadora` (con sección "con operador") |
| 11 | precio arriendo retroexcavadora día | Alto (informacional) | Alta | Informacional | NEW: `/recursos/precio-arriendo-retroexcavadora-chile` |
| 12 | diferencia retroexcavadora miniexcavadora | Medio | Baja | Informacional | NEW: `/recursos/diferencia-retro-mini` |
| 13 | minicargador bobcat arriendo | Medio | Media | Comercial | `/maquinarias?tipo=minicargador` |
| 14 | maquinaria pesada arriendo maule | Medio | Media | Comercial | `/maquinarias` |
| 15 | constructora industrial maule | Bajo-medio | Media | Comercial B2B | `/` + `/proyectos` |

### Barraca (barraca.jurmaq.cl)

| # | Keyword | Volumen est. | Dificultad | Intent | Page objetivo |
|---|---------|--------------|------------|--------|---------------|
| 16 | fierro estriado 12mm precio | Alto | Media | Comercial | `/producto/fierro-estriado-12mm-6m` (o slug exacto) |
| 17 | fierro estriado 8mm curicó | Medio | Baja | Comercial | `/material/fierro-estriado-en-curico` |
| 18 | barraca fierros curicó | Alto | Media | Navegacional/comercial | `/` (home barraca) |
| 19 | cemento polpaico 25kg precio | Alto | Alta | Comercial | `/producto/cemento-polpaico-25kg` |
| 20 | malla acma c92 precio | Medio | Media | Comercial | `/producto/malla-acma-c92` |
| 21 | plancha zinc 0.35 precio | Alto | Media | Comercial | `/producto/plancha-zinc-035` |
| 22 | perfil cuadrado 50x50 precio | Medio | Media | Comercial | `/producto/tubo-cuadrado-50x50` |
| 23 | materiales construcción curicó | Alto | Alta | Comercial | `/` + `/categorias` |
| 24 | ferretería online maule | Medio | Media | Comercial | `/` (con keyword en H1 ampliado) |
| 25 | sherwin williams curicó precio | Medio | Baja | Comercial | `/categorias/pinturas` |
| 26 | barraca molina | Medio | Baja | Navegacional | `/sucursales` + `/en/molina` |
| 27 | calculadora cemento radier | Medio | Baja | Informacional | `/calculadora-cemento` |
| 28 | cuánto fierro necesito columna | Bajo-medio | Baja | Informacional | `/calculadora-fierro` |
| 29 | despacho fierros región maule | Medio | Baja | Comercial | `/en/[ciudad]` landings |
| 30 | comprar fierro online chile | Alto | Alta | Comercial | `/` (CTA mejor precio) |

**Long-tail oportunidades no listadas pero capturables vía pSEO** (próximas 100+ pages):

- `arriendo {maquina} en {ciudad}` × 7 tipos × 12 ciudades = 84 (ya cubierto)
- `{maquina-modelo} arriendo {ciudad}` × ~20 máquinas × 12 ciudades = 240 (A1, no cubierto)
- `{material} en {ciudad}` × 8 materiales × 12 ciudades = 96 (ya cubierto)
- `{categoria} en {ciudad}` × ~20 categorías × 12 ciudades = 240 (A7, no cubierto)
- `cómo {accion} {producto}` × ~30 patrones × variantes = blog (A2, no cubierto)

---

## 4. Plan de páginas programáticas a crear

### 4.1 — `/maquinarias/[slug]/en/[ciudad]` (constructora) — A1

**Pattern**: máquina-específica del catálogo × ciudad servida
**Volumen**: ~20 maquinarias × 12 ciudades = **240 landings**
**URL ejemplo**: `jurmaq.cl/maquinarias/xcmg-xe35u-miniexcavadora-12/en/talca`

**Estructura de contenido sugerida** (cada page debe ser único, no template trivial):

- **H1**: "Arriendo XCMG XE35U Miniexcavadora en Talca · JURMAQ"
- **Sección 1**: ficha técnica de la máquina (peso, profundidad excavación, motor) — extraído de `maquinarias` DB
- **Sección 2**: cómo llega a Talca (distancia desde HQ Curicó/Molina vía `DISTANCIAS_CONSTRUCTORA[ciudad.slug]`, tiempo de despacho)
- **Sección 3**: casos de uso típicos en Talca específicamente (usar `CIUDADES[ciudad].contextoLocal` + `CIUDADES[ciudad].rubroLocal`)
- **Sección 4**: FAQ específica máquina+ciudad
- **Sección 5**: CrossLinksGrid a otras máquinas en la misma ciudad + a otras ciudades para la misma máquina
- **Sección 6**: CTA Cotizar (form pre-poblado con `?maquinariaId=X&ciudad=talca`)

**JSON-LD**: `Product` con `offers` específico de la máquina + `LocalBusiness` con `areaServed` apuntando a la ciudad + `BreadcrumbList`.

**Anti-doorway-page**: cada page tiene contexto local distinto (rubros económicos de la comuna, distancia + tiempo real desde HQ, FAQs específicas). No es solo "máquina + ciudad" repetido.

### 4.2 — `/recursos/[slug]` (constructora) — A2

**Pattern**: blog/recursos informacional
**Volumen MVP**: 8 artículos seed; escalable a 30-50 en 6 meses

**Artículos seed propuestos**:

1. `precio-arriendo-retroexcavadora-chile-2026` — tabla comparativa por hora/día/semana/mes
2. `diferencia-retroexcavadora-miniexcavadora` — guía decisión con casos de uso
3. `cuanto-cuesta-arrendar-maquinaria-pesada` — pricing breakdown + factores
4. `arriendo-maquinaria-con-o-sin-operador` — checklist operador certificado Sernageomin
5. `como-calcular-volumen-excavacion-zanja` — calculadora + ejemplos
6. `que-maquinaria-elegir-fundacion-casa` — flujo de decisión visual
7. `arriendo-minicargador-implementos-disponibles` — guía implementos (balde, auger, escoba, etc.)
8. `seguros-y-responsabilidad-arriendo-maquinaria` — qué cubre el contrato JURMAQ

**Estructura**: H1 keyword-rich, intro self-contained (Featured Snippet + AI search citation friendly), TOC, secciones H2 con keywords secundarios, FAQ schema al final, CTA contextual a cotización.

### 4.3 — `/categorias/[slug]/en/[ciudad]` (barraca) — A7

**Pattern**: categoría barraca × ciudad
**Volumen**: ~20 categorías activas × 12 ciudades = **240 landings**
**URL ejemplo**: `barraca.jurmaq.cl/categorias/fierros-construccion/en/talca`

Similar a A1 pero para barraca. Combinar categoría con contexto local de la ciudad.

### 4.4 — `/proyectos/[slug]` (constructora) — A12

**Pattern**: case studies B2B
**Volumen**: 5-6 obras emblemáticas (Nestlé Teno, Miguel Torres, Iansagro, Surfrut, Cementos Biobío, etc.)

JSON-LD: `Article` + `Project` (custom) + foto galería + `Review` si hay testimonio del cliente.

**No es programmatic** sino content de alto valor, pero impacta keywords B2B ("constructora industrial maule", "fundaciones silos chile") + autoridad de marca.

---

## 5. Estrategia de content + linking

### 5.1 — Hub & spoke

**Hubs principales** (alta autoridad):

- Constructora: `/` (home), `/maquinarias`, `/recursos` (nuevo), `/proyectos`
- Barraca: `/` (home barraca), `/categorias`, `/guias`, `/calculadoras`

**Spokes**: pages programáticas (ciudad×tipo, máquina×ciudad, material×ciudad, categoría×ciudad, productos, máquinas individuales).

**Cross-links obligatorios**:

- Cada spoke ciudad×tipo linkea a (a) la página de la ciudad genérica, (b) la página del tipo genérico, (c) otras 3 ciudades cercanas (usar `comunasVecinas` de CIUDADES), (d) 2 máquinas concretas de ese tipo. → ya implementado parcialmente con CrossLinksGrid.
- Cada producto barraca linkea a (a) categoría padre, (b) 4 productos relacionados misma categoría, (c) calculadora si aplica.
- Cada máquina constructora linkea a (a) tipo genérico, (b) ciudades servidas top 3, (c) otra máquina similar del mismo tipo.

### 5.2 — Cross-brand linking

**Footer constructora → barraca**: ya existe.
**Home constructora → barraca**: existe pero como link `/barraca` que pasa por redirect 301 (middleware). Mejorar a link directo cross-domain `https://barraca.jurmaq.cl/` con `rel="noopener"` (no `nofollow` — es propiedad propia).

**Footer barraca → constructora**: existe.
**Inverso**: agregar bloque "¿También necesitas maquinaria para tu obra?" en barraca home o en producto de fierros (intent crossover claro).

### 5.3 — Anchor text strategy

- **Internal**: descriptivo + keyword. Mal: "ver más". Bien: "Ver arriendo de retroexcavadoras en Curicó".
- **External (escasos)**: `rel="noopener noreferrer nofollow"` para WhatsApp wa.me (ya implementado).
- **Cross-domain owned (jurmaq.cl ↔ barraca.jurmaq.cl)**: SIN `nofollow` — son propiedad propia, queremos flujo de autoridad.

### 5.4 — Backlinks (off-page — fuera de implementación, documentar plan)

Recomendaciones para acción manual del usuario:

1. **Google Business Profile** verificado y completo para ambas direcciones (Maquehua, Curicó / Av. Poniente 2157, Molina). Subir fotos, atender reviews. Single fuente más impactante para SEO local.
2. **Directorios chilenos**: Mercantil.com, MundoChileno, Páginas Amarillas Chile, Yapo (perfil empresa), Tiendeo. Asegurar NAP consistente (Nombre, Address, Phone).
3. **Gremios**: CChC (Cámara Chilena de la Construcción) — verificar si JURMAQ es socio o si puede figurar en directorio público.
4. **Reviews**: pedir review en Google Business a 5 clientes top (Nestlé Teno responsable de obra, Iansagro, Miguel Torres, etc.). Schema `Review` se incrementa.
5. **Press / PR local**: comunicados en La Prensa de Curicó, El Centro de Talca cuando se completa obra grande.
6. **Cross-link con clientes**: si los proyectos están en la web de Nestlé/Iansa, pedir link backlink al case study `/proyectos/[slug]`.
7. **Patrocinio o partnership con escuelas de construcción** (Inacap Curicó, Sence) — link educacional alto valor.

---

## 6. Lista de chips spawned

Cada issue 🔴 CRÍTICO + 🟡 ALTO recibe su propio chip. Issues 🟢 MEDIO se agrupan en 3 chips temáticos. 🔵 BAJO se agrupa en 1 chip.

(Ver sección final del documento para el listado de chips spawned y al panel de tasks de Cowork.)

---

## 7. Restricciones globales

- **NO modificar** `apps/barraca/src/app/api/carrito/route.ts` (cart fix recién aplicado).
- **NO modificar** `apps/constructora/src/lib/pricing-arriendo.ts` ni la lógica de display de precios en `apps/constructora/src/app/maquinarias/page.tsx` (recién fixeados).
- **NO desplegar**: el usuario despliega manualmente con `vercel --prod --yes` cuando esté listo.
- **Antes de tocar metadata**: leer `packages/shared/src/seo/index.ts` y `packages/shared/src/seo/jsonld.ts` para entender la convención existente.
- **Antes de crear pages**: revisar `apps/constructora/src/app/arriendo-en/[ciudad]/[tipo]/page.tsx` y `apps/barraca/src/app/material/[slug]/page.tsx` (ya existentes) como patrón de referencia para pSEO.
- **Typecheck obligatorio** antes de cerrar cada chip: `pnpm -C apps/constructora typecheck && pnpm -C apps/barraca typecheck`.

---

## 8. ETA estimado total (horas-hombre)

| Tipo | Issues | Horas estimadas |
|------|--------|-----------------|
| 🔴 CRÍTICO | C1–C5 | 4–6h |
| 🟡 ALTO | A1–A12 | 40–60h |
| 🟢 MEDIO | M1–M13 (agrupado en 3 chips) | 6–8h |
| 🔵 BAJO | B1–B7 (1 chip) | 2–3h |
| **Total** | | **52–77h** |

Despliegue completo en sprints quincenales: ~4-6 sprints de 12-15h/sprint.

---

## 9. Métricas de seguimiento sugeridas

Una vez setup GSC (chip C1):

- **Indexed pages count** — verificar que sitemap.xml URLs estén siendo crawled
- **Average position** por keyword cluster (arriendo, materiales, ciudades)
- **CTR** en queries top 20
- **Core Web Vitals** real-user (GSC > Page Experience) — debería ser "Good" en LCP/INP/CLS post C2
- **Backlinks** crecimiento via Ahrefs free tier o GSC referring domains
- **Search appearance** rich results (FAQ, Product, BreadcrumbList) sin errores

Setup secundario: Vercel Speed Insights (gratis con plan actual) para Core Web Vitals continuos sin depender de Google.

---

**Fin del master plan.** Los chips spawned tienen prompts self-contained para ejecución autónoma — ver el panel de tasks de Cowork en esta sesión.
