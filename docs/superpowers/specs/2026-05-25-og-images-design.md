# OG Images — JURMAQ Constructora + Barraca

**Fecha**: 2026-05-25
**Estado**: aprobado (verbal, "hazlas nomás")
**Deliverables**:
- `apps/constructora/public/og-image-1200x630.png`
- `apps/barraca/public/og-image-barraca-1200x630.png`

## Contexto

Ambos `layout.tsx` referencian estos archivos en `openGraph.images[0]` pero los PNGs no existen. Hasta que se creen, Facebook/LinkedIn/WhatsApp caen al fallback `icon-512.png` (cuadrado, sin aspect-ratio OG).

## Decisiones de dirección (locked)

| Eje | Valor |
|---|---|
| Tono visual | Editorial premium (consistente con sistema "Editorial Luxury" del site) |
| Hero constructora | `apps/constructora/public/images/maquinarias/retroexcavadora-hmk-102b.jpg` |
| Hero barraca | `apps/barraca/public/images/barraca-hero.jpg` (perfil L de acero) |
| Tipografía display | Newsreader serif (consistente con `.editorial-h1`) |
| Tipografía UI | Geist sans |
| Output specs | PNG 1200×630, < 300KB, zona segura central 600×315 |

## Composición — Constructora OG

**Pattern**: Full-bleed photo + diagonal gradient overlay + bottom-left typography.

Bloques (de fondo a frente):

1. **Base**: `retroexcavadora-hmk-102b.jpg`, `object-fit: cover`, posición center-center
2. **Gradient overlay**: `linear-gradient(135deg, rgba(12,29,58,0.92) 0%, rgba(12,29,58,0.55) 50%, rgba(12,29,58,0.20) 100%)`
   - Navy = `#0c1d3a` (navy-900, color institucional)
   - Asegura legibilidad del texto en top-left y bottom-left
3. **Padding container**: 64px top/right/bottom/left
4. **Top-left**: eyebrow tag
   - Texto: `ARRIENDO MAQUINARIA · REGIÓN DEL MAULE`
   - Estilo: Geist 12px, weight 600, tracking +0.18em, uppercase, color gold `#e6b422`
5. **Bottom-left** (anclado a `bottom: 64px`):
   - **Headline**: `Maquinaria pesada\nen arriendo.`
     - Newsreader 68px, weight 500, line-height 1.05, letter-spacing -0.025em, color `#FFFFFF`
     - 2 líneas hard-wrap
   - **Hairline**: 48px × 2px, color gold `#e6b422`, margin-top 24px
   - **Tagline**: `JURMAQ · Curicó · +25 años en construcción`
     - Geist 18px, weight 400, color `rgba(255,255,255,0.85)`, margin-top 16px

## Composición — Barraca OG

**Pattern**: Split 50/50 — typography card + product photo.

Layout:

```
┌──────────────────────────┬──────────────────────────┐
│  Left (600px wide)       │  Right (600px wide)      │
│  bg: #F7F6F3 surface-alt │  bg: #FFFFFF             │
│                          │                          │
│  [eyebrow]               │   [barraca-hero.jpg      │
│                          │    cropped center,       │
│  Fierros                 │    object-fit: contain,  │
│  y materiales            │    padding 48px]         │
│  ─                       │                          │
│  Curicó · Molina         │                          │
│                          │                          │
└──────────────────────────┴──────────────────────────┘
```

Bloques:

1. **Left half** (0 → 600px):
   - Fondo: `#F7F6F3` (surface-alt warm bone)
   - Padding: 64px
   - **Eyebrow top-left**: `BARRACA JURMAQ · +1.600 PRODUCTOS`
     - Geist 12px, 600, tracking +0.18em, uppercase, color red `#9F2F2D`
   - **Headline** (vertical center, anclado izquierda):
     - `Fierros\ny materiales`
     - Newsreader 64px, weight 500, line-height 1.05, color ink `#111111`
   - **Hairline**: 48px × 2px, color red `#9F2F2D`, margin-top 24px
   - **Tagline**: `Curicó · Molina · Región del Maule`
     - Geist 18px, color ink-muted `#787774`, margin-top 16px
2. **Vertical divider** (en x=600):
   - 1px de ancho, color `#EAEAEA` (hairline)
3. **Right half** (600 → 1200):
   - Fondo: `#FFFFFF` (puro, coincide con el fondo blanco del product-shot)
   - `barraca-hero.jpg` centrada, `object-fit: contain`, padding 48px
   - Sin overlay (la foto ya es minimal)

## Implementación — approach

**Stack**: Node script one-off con `puppeteer-core` + system Chrome (Mac local). No requiere nuevas dependencias.

**Razones**:
- `puppeteer-core` ya está en ambos `package.json` (usado por pdf-generator.ts)
- Google Chrome está en `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Resultado es 2 archivos estáticos commiteados — no necesita correr en producción
- Mantenemos el script en `scripts/og/` por si hay tweaks futuros

**Flujo del script**:

1. Lee assets locales (foto hero) y los inlinea como `data:image/...;base64,...` en el HTML
2. Construye 2 strings HTML completos (uno por OG) con CSS inline
   - Fuentes vía Google Fonts CDN (`https://fonts.googleapis.com/css2?family=Newsreader:wght@500&family=Geist:wght@400;600`)
   - `waitUntil: 'networkidle0'` para que las fonts carguen antes del screenshot
3. Lanza puppeteer-core apuntando a system Chrome
4. Por cada HTML:
   - `page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })`
   - `page.setContent(html, { waitUntil: 'networkidle0' })`
   - `page.screenshot({ type: 'png', omitBackground: false })`
5. Guarda los 2 PNGs en sus rutas finales
6. Imprime tamaño de cada archivo + warning si supera 300KB

**Validación post-generación**:

- `file <path>` confirma 1200×630 RGB/RGBA
- `du -h <path>` confirma < 300KB
- `curl -s https://jurmaq.cl | grep og:image` (cuando esté deployed) o local con `pnpm dev:constructora` + curl
- Opcional: opengraph.xyz preview manual del user

## Riesgos / consideraciones

- **Fonts no cargan a tiempo** → mitigación: `waitUntil: 'networkidle0'` + 500ms extra wait. Si falla, fallback a `font-family: serif` y `font-family: -apple-system, system-ui, sans-serif`.
- **PNG supera 300KB** → mitigación: si pasa, post-procesamos con `sharp` (no instalado pero trivial agregar) o `pngquant` CLI. Estimación a 1200×630 con foto + texto = ~200-260KB sin optimización.
- **Crop de la foto retroexcavadora** → original 2560×1707 px (Canon EOS 5D MK IV), zero upscale problemático. Crop a 1200×630 reduce ~2.1x; full quality garantizado.
- **Texto eyebrow conflicto con info densa** → si el headline + tagline cubren más del 60% del canvas izquierdo, ajustar font-size del headline a 60px.

## Out of scope (NO incluido)

- OG images por producto individual (ya existe lógica en `producto/[slug]/page.tsx` que usa foto del producto cuando hay)
- OG images por máquina individual (ya existe lógica en `maquinarias/[id]/page.tsx`)
- Twitter Card alt-text (ya está en metadata, no cambia)
- Versiones en otros aspect ratios (1:1, 4:5) — solo 1200×630
- Animaciones / video previews
