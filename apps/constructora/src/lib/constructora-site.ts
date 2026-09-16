/**
 * Configuración del subdominio constructora.jurmaq.cl (obras civiles B2B).
 *
 * ## Arquitectura: un solo Next.js, tres dominios
 *
 * `apps/constructora` sirve DOS hosts:
 *   - `jurmaq.cl`               → hub + arriendo de maquinaria (rutas en `/`)
 *   - `constructora.jurmaq.cl`  → obras civiles (rutas en `/constructora/*`)
 *
 * El middleware hace un rewrite por Host: `constructora.jurmaq.cl/servicios`
 * se sirve internamente desde `/constructora/servicios`. Por eso **los links
 * internos de estas páginas se escriben SIN el prefijo `/constructora`**
 * (`href="/servicios"`), que es la URL real que ve el usuario y Google.
 *
 * Para que ese prefijo no genere contenido duplicado, el middleware además
 * redirige 301 `jurmaq.cl/constructora/*` → `constructora.jurmaq.cl/*`. Así
 * cada página vive en UNA sola URL indexable.
 *
 * `barraca.jurmaq.cl` es una app aparte (`apps/barraca`), no se toca acá.
 */

import { LEGAL_INFO } from '@jurmaq/shared/seo';

/** Origen canónico del subdominio. Sin slash final. */
export const CONSTRUCTORA_URL = 'https://constructora.jurmaq.cl';

/** Prefijo interno de rutas. El usuario nunca lo ve (lo agrega el middleware). */
export const CONSTRUCTORA_PREFIX = '/constructora';

/**
 * Construye una URL canónica absoluta del subdominio.
 * `canonical('/servicios')` → `https://constructora.jurmaq.cl/servicios`
 */
export function canonical(path = '/'): string {
  const clean = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `${CONSTRUCTORA_URL}${clean}`;
}

/** Datos comerciales de la unidad constructora (fuente única en shared). */
export const CONSTRUCTORA_INFO = LEGAL_INFO.brands.constructora;

/**
 * Comunas objetivo para las landings de SEO local `/obras-civiles-en/[ciudad]`.
 *
 * NO reusamos las 12 ciudades de `CIUDADES` (shared) porque ese set está
 * calibrado para arriendo de maquinaria B2C. Obra civil industrial se vende
 * donde hay **planta**: por eso incluimos Teno, Romeral y San Javier (polo
 * agroindustrial) y dejamos fuera comunas sin tejido industrial relevante
 * como Vichuquén o Licantén, donde una landing solo generaría thin content.
 *
 * `industria` alimenta el copy real de cada landing — es lo que hace que la
 * página no sea la misma plantilla con el nombre cambiado.
 */
export interface ComunaObra {
  slug: string;
  nombre: string;
  /** Preposición correcta: "en Curicó" vs "en la comuna de..." */
  provincia: string;
  /** Distancia en km desde la oficina de Curicó (Maquehua). */
  distanciaKm: number;
  /** Tejido industrial real de la comuna. Alimenta el copy. */
  industria: string;
  /** Mandantes/rubros típicos. */
  rubros: string[];
  geo: { lat: number; lng: number };
  /** Última edición real del texto (YYYY-MM-DD). Alimenta el lastmod del sitemap. */
  actualizado: string;
  /**
   * Si esta comuna tiene landing propia en `/obras-civiles-en/[slug]`.
   *
   * Solo las cuatro donde hay OBRA EJECUTADA que mostrar. Medido sobre el HTML
   * ya compilado, las diez landings compartían 2.349 caracteres de plantilla
   * idéntica y aportaban 449 caracteres únicos de media — 84% plantilla. Eso
   * es una doorway page, y es lo que tenía a Google reportando "Descubierta:
   * actualmente sin indexar" en 25 de 26 URLs.
   *
   * Se podría haber rellenado con texto genérico por comuna, pero inventar
   * detalles de obra que no existen es exactamente lo contrario de lo que hace
   * útil a estas páginas. Cuatro páginas con una obra real detrás pesan más
   * que diez descartadas por el rastreador.
   *
   * Las seis restantes siguen en `areaServed` del JSON-LD y en la lista de
   * cobertura del sitio —el despacho a esas comunas es real—, solo dejan de
   * tener URL propia. El middleware las redirige 301 a /servicios.
   *
   * Para habilitar una nueva: conseguir la obra, documentarla en
   * `proyectos-data.ts` y recién entonces poner `tienePagina: true`.
   */
  tienePagina: boolean;
}

export const COMUNAS_OBRA: ComunaObra[] = [
  {
    slug: 'curico',
    nombre: 'Curicó',
    provincia: 'Curicó',
    distanciaKm: 0,
    industria:
      'centro industrial y de servicios de la provincia, con plantas de alimentos, packing de fruta, maestranzas y el mayor movimiento de obra civil privada del Maule norte',
    rubros: ['Agroindustria', 'Packing y frigoríficos', 'Maestranzas', 'Bodegas de distribución'],
    geo: { lat: -34.9833, lng: -71.2333 },
    actualizado: '2026-09-16',
    tienePagina: true,
  },
  {
    slug: 'teno',
    nombre: 'Teno',
    provincia: 'Curicó',
    distanciaKm: 18,
    industria:
      'polo de plantas de alimentos de escala nacional —incluida la planta de Nestlé donde ejecutamos las fundaciones de silos— además de packing y agrícolas de exportación',
    rubros: ['Plantas de alimentos', 'Silos y almacenamiento', 'Packing de exportación'],
    geo: { lat: -34.8703, lng: -71.1636 },
    actualizado: '2026-09-16',
    tienePagina: true,
  },
  {
    slug: 'molina',
    nombre: 'Molina',
    provincia: 'Curicó',
    distanciaKm: 22,
    industria:
      'zona vitivinícola y agroindustrial, con bodegas de vino, plantas de proceso y donde además está nuestra barraca de fierros',
    rubros: ['Viñas y bodegas', 'Agroindustria', 'Bodegas y galpones'],
    geo: { lat: -35.1147, lng: -71.2839 },
    actualizado: '2026-09-16',
    tienePagina: false,
  },
  {
    slug: 'romeral',
    nombre: 'Romeral',
    provincia: 'Curicó',
    distanciaKm: 16,
    industria:
      'concentración de deshidratado y proceso de fruta —ahí ejecutamos las obras y la cubierta de silos de Surfrut— junto a agrícolas de exportación',
    rubros: ['Deshidratado de fruta', 'Silos y cubiertas', 'Agrícolas de exportación'],
    geo: { lat: -34.9694, lng: -71.1244 },
    actualizado: '2026-09-16',
    tienePagina: true,
  },
  {
    slug: 'sagrada-familia',
    nombre: 'Sagrada Familia',
    provincia: 'Curicó',
    distanciaKm: 25,
    industria:
      'comuna agrícola con packing, bodegas de proceso y creciente inversión en infraestructura de riego y almacenamiento',
    rubros: ['Packing', 'Bodegas agrícolas', 'Infraestructura de riego'],
    geo: { lat: -34.9739, lng: -71.3861 },
    actualizado: '2026-09-16',
    tienePagina: false,
  },
  {
    slug: 'rauco',
    nombre: 'Rauco',
    provincia: 'Curicó',
    distanciaKm: 20,
    industria:
      'zona frutícola con packing y bodegas de acopio que requieren obra civil de ampliación y mantención estructural',
    rubros: ['Packing de fruta', 'Bodegas de acopio', 'Obras agrícolas'],
    geo: { lat: -34.9294, lng: -71.4139 },
    actualizado: '2026-09-16',
    tienePagina: false,
  },
  {
    slug: 'talca',
    nombre: 'Talca',
    provincia: 'Talca',
    distanciaKm: 63,
    industria:
      'capital regional y mayor concentración industrial del Maule, con plantas de alimentos, papeleras, metalmecánica y obra pública y privada de escala',
    rubros: ['Industria pesada', 'Plantas de alimentos', 'Metalmecánica', 'Obra pública'],
    geo: { lat: -35.4264, lng: -71.6554 },
    actualizado: '2026-09-16',
    tienePagina: false,
  },
  {
    slug: 'linares',
    nombre: 'Linares',
    provincia: 'Linares',
    distanciaKm: 110,
    industria:
      'polo azucarero y agroindustrial —donde hacemos la mantención industrial de Iansagro— con plantas de proceso que operan por temporada',
    rubros: ['Agroindustria azucarera', 'Plantas de proceso', 'Mantención industrial'],
    geo: { lat: -35.8464, lng: -71.5931 },
    actualizado: '2026-09-16',
    tienePagina: true,
  },
  {
    slug: 'san-javier',
    nombre: 'San Javier',
    provincia: 'Linares',
    distanciaKm: 85,
    industria:
      'corazón vitivinícola del valle del Maule, con bodegas, salas de guarda y plantas de embotellado que demandan obra civil especializada',
    rubros: ['Viñas y bodegas', 'Embotelladoras', 'Salas de guarda'],
    geo: { lat: -35.5936, lng: -71.7331 },
    actualizado: '2026-09-16',
    tienePagina: false,
  },
  {
    slug: 'constitucion',
    nombre: 'Constitución',
    provincia: 'Talca',
    distanciaKm: 130,
    industria:
      'polo forestal y de celulosa, con instalaciones industriales de gran escala que requieren mantención estructural y obra civil complementaria',
    rubros: ['Forestal y celulosa', 'Mantención industrial', 'Obra civil complementaria'],
    geo: { lat: -35.3332, lng: -72.4167 },
    actualizado: '2026-09-16',
    tienePagina: false,
  },
];

/** Comunas con landing propia. Ver la nota de `tienePagina`. */
export function comunasConPagina(): ComunaObra[] {
  return COMUNAS_OBRA.filter((c) => c.tienePagina);
}

export function getComunaBySlug(slug: string): ComunaObra | undefined {
  return COMUNAS_OBRA.find((c) => c.slug === slug);
}
