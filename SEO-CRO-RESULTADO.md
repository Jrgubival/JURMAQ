# Mejoras SEO/CRO — Arriendo + Barraca (resultado)

Rama: `seo-cro-arriendo-barraca`. Diagnóstico desde Google Search Console (28d):
el sitio **rankea bien pero no convierte ranking en clics ni mide lo que convierte**.
Foco: subir CTR (títulos) + cablear medición de conversión + más solicitudes de arriendo.

## ✅ Implementado (typecheck verde en ambas apps)

### Fase 1 — CTR + tracking
- **Título ficha de máquina** → lidera con precio/"valor hora" en la unidad real de la
  tarifa (antes hardcodeaba "/día"). Captura "valor hora retroexcavadora" (rankeaba #1–4.5
  con 0 clics). `apps/constructora/src/app/maquinarias/[id]/page.tsx`
- **Título type-landing** → marca/modelo real en el título visible: XCMG XE35U,
  Hidromek HMK 102B, Bobcat S650. Captura "arriendo excavadora xcmg" (78 impr, pos 10, 0
  clics). `apps/constructora/src/app/arriendo/[tipo]/page.tsx`
- **Tracking WhatsApp** → 5 CTAs migrados de `<a>` crudo a `WhatsappLink` (con
  `whatsappClick(source)`): PricingTiers, ficha fallback, type-landing ×2, city-landing ×2.
  Era el canal #1 de conversión y estaba invisible en GA4.
- **generate_lead barraca** → toda cotización enviada ahora dispara el lead (antes solo con
  archivo de competencia). Deduplicado por número. `apps/barraca/src/app/cotizar/page.tsx`
- **search event barraca** → ya estaba cableado en `SearchBar.handleSubmit` (verificado).

### Fase 2 — CRO + geo + rich snippets
- **CTA sticky móvil** en ficha de máquina (Cotizar + WhatsApp, siempre visible).
  `apps/constructora/src/components/public/StickyMobileCTA.tsx`
- **Título producto barraca** con precio + stock real en el `<title>` visible (antes solo
  decía "Precio y Stock"). Captura "fierro estriado 18mm", "cemento talca", "perfiles curico".
- **Geo Talca/Linares**: eyebrow del hero ampliado + bloque CrossLinksGrid city×type
  (`/arriendo-en/talca/[tipo]`, `/linares/...`) para subir esas landings vía enlazado interno.
- **AggregateRating REAL** en producto barraca: se inyecta solo si hay reviews moderadas
  (`barraca_productos_rating`, estado 'aprobada'). Nunca fabricado → estrellas legítimas en
  Google cuando haya reviews. El cron `post-purchase` ya pide reseñas 7–14 días post-compra.

### Fase 3 — Contenido (recursos)
- Reescrito el título del recurso de precio con el rango numérico al frente.
- 2 recursos nuevos (SSG + FAQ schema + cross-links): `valor-hora-retroexcavadora` y
  `arriendo-miniexcavadora-xcmg-xe35u`. Se auto-incluyen en sitemap e índice /recursos.

## 🚩 BLOQUEANTE — requiere tu acción (GA4 NO está activo)

Verifiqué **en vivo**: jurmaq.cl y barraca.jurmaq.cl **NO cargan GA4** (sin `dataLayer`,
sin `gtag`, sin scripts de Google). El `NEXT_PUBLIC_GA_MEASUREMENT_ID` no está seteado en
Vercel. **Sin esto, ninguno de los eventos de conversión que cablé registra datos.**

Para activarlo (10 min):
1. Crear propiedad GA4 en https://analytics.google.com (o usar una existente) → copiar el
   **Measurement ID** (`G-XXXXXXXX`).
2. En Vercel, proyecto **jurmaq-app** (constructora) y **jurmaq-barraca**:
   Settings → Environment Variables → agregar `NEXT_PUBLIC_GA_MEASUREMENT_ID = G-XXXXXXXX`
   (Production). Redeploy.
3. En GA4 → Admin → Eventos: marcar como **conversión**: `generate_lead`, `whatsapp_click`,
   `arriendo_cotizacion_submitted`.
4. Verificar en GA4 DebugView que los eventos llegan al navegar y hacer clic en WhatsApp/cotizar.

> Nota: el código de tracking ya está 100% listo. Solo falta el measurement id en Vercel.

## Verificación pendiente (post-deploy)
- GSC Performance a 2–4 semanas: CTR de las consultas objetivo (valor hora, xcmg, fierro 18mm).
- Rich Results Test sobre ficha de máquina y producto barraca (Product/Offer/FAQ).
- Medir nº de cotizaciones de arriendo y leads barraca antes/después.
