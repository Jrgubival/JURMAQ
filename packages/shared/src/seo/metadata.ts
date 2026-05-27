/**
 * Helper compartido para construir el objeto `Metadata` de Next.js en pages
 * de `apps/constructora` y `apps/barraca`.
 *
 * El objetivo es centralizar campos repetitivos (canonical URL, siteName,
 * locale, twitter card, OG image, OG type) para que cada page solo declare lo
 * que es propio: title, description, path y opcionalmente keywords/imagen
 * custom. Reduce drift entre pages cuando se introduce un campo nuevo y evita
 * que las legales/contacto repitan boilerplate de marketing.
 *
 * ## Decisiones de diseño
 *
 * - **No agrega `" | JURMAQ"` al title**: el `layout.tsx` de ambas apps usa
 *   `template: "%s"` (sin suffix automático) tras la fix de duplicación —
 *   commit `34e73bd`. Pasar el title completo y final.
 * - **OG title/description = top-level**: si una page necesita un OG distinto
 *   (marketing landing con copy más colorido) NO usar este helper o pasarle
 *   el title/description ya distintos vía el constructor de la Metadata raw.
 *   Las pages legales/contacto no necesitan esa variación.
 * - **canonical y OG.url** se construyen con `BASE_URLS[brand] + path`.
 *
 * ## Uso típico
 *
 * ```ts
 * import { buildPageMetadata } from '@jurmaq/shared/seo/metadata';
 *
 * export const metadata = buildPageMetadata({
 *   brand: 'constructora',
 *   title: 'Términos y Condiciones | Constructora Jorge Ubilla Rivera E.I.R.L.',
 *   description: 'Términos y condiciones de uso del sitio web JURMAQ.cl...',
 *   path: '/terminos',
 * });
 * ```
 *
 * Page de marketing con copy custom para OG (NO usar este helper):
 *
 * ```ts
 * export const metadata: Metadata = {
 *   title: '...',
 *   description: '...',
 *   openGraph: { title: 'Copy distinto para sociales', ... },
 * };
 * ```
 */

import type { Metadata } from "next";

export type Brand = "constructora" | "barraca";

export interface BuildPageMetadataOptions {
  brand: Brand;
  /** Title final tal como aparecerá en `<title>`. El helper NO agrega sufijos. */
  title: string;
  description: string;
  /** Path relativo al dominio, ej. `"/maquinarias/retroexcavadora-12"`. */
  path?: string;
  /** Override del OG image. Si se omite, usa el default por brand (1200×630). */
  ogImage?: { url: string; width: number; height: number; alt: string };
  /**
   * `og:type` para el OG card. Solo `"website"` y `"article"` son válidos —
   * Next.js no admite `"product"` (info de producto va en JSON-LD Product
   * schema, no en `og:type`). Default: `"website"`.
   */
  ogType?: "website" | "article";
  /** Si se omite, no incluye meta keywords (Google los ignora hace años). */
  keywords?: string[];
  /** Si `true`, agrega `robots: { index: false, follow: false }`. */
  noindex?: boolean;
}

const BASE_URLS = {
  constructora: "https://jurmaq.cl",
  barraca: "https://barraca.jurmaq.cl",
} as const;

const DEFAULT_OG_IMAGES = {
  constructora: {
    url: "/og-image-1200x630.png",
    width: 1200,
    height: 630,
    alt: "JURMAQ",
  },
  barraca: {
    url: "/og-image-barraca-1200x630.png",
    width: 1200,
    height: 630,
    alt: "Barraca JURMAQ",
  },
} as const;

const SITE_NAMES = {
  constructora: "JURMAQ",
  barraca: "Barraca JURMAQ",
} as const;

export function buildPageMetadata(opts: BuildPageMetadataOptions): Metadata {
  const baseUrl = BASE_URLS[opts.brand];
  const path = opts.path ?? "";
  const url = `${baseUrl}${path}`;
  const ogImage = opts.ogImage ?? DEFAULT_OG_IMAGES[opts.brand];

  return {
    title: opts.title,
    description: opts.description,
    ...(opts.keywords && opts.keywords.length > 0
      ? { keywords: opts.keywords }
      : {}),
    alternates: { canonical: url },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: SITE_NAMES[opts.brand],
      locale: "es_CL",
      type: opts.ogType ?? "website",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
    },
    ...(opts.noindex
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
