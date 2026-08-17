/**
 * JSON-LD `@graph` shared helper para SEO root layout.
 *
 * Construye Organization + LocalBusiness + WebSite parametrizado por brand,
 * usando los datos canonical de `LEGAL_INFO` (sin duplicar address/telefono).
 *
 * Por qué:
 * - **Organization** es la misma persona jurídica para ambas brands
 *   (Constructora Jorge Ubilla Rivera E.I.R.L. — un RUT, un legalName).
 * - **LocalBusiness** depende de la brand (constructora opera desde Maquehua,
 *   barraca desde Molina — distintos `address`, `geo`, `name`, `description`).
 * - **WebSite** depende del dominio (jurmaq.cl vs barraca.jurmaq.cl).
 *
 * Uso:
 *   import { buildJsonLdGraph } from '@jurmaq/shared/seo/jsonld';
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLdGraph('constructora')) }}
 *   />
 *
 * Validación: pasar el HTML resultante por
 * https://search.google.com/test/rich-results
 */

import { LEGAL_INFO } from './index';

/**
 * Serializa un objeto a JSON seguro para inyectar dentro de un
 * `<script type="application/ld+json" dangerouslySetInnerHTML>`.
 *
 * SECURITY (audit jun-2026, hallazgo M-2): `JSON.stringify` escapa comillas y
 * backslashes, pero NO escapa `<`, `>` ni `&`. Si un campo dinámico de la DB
 * (nombre/descripción de producto o máquina, editable por un vendedor) contiene
 * `</script><script>…</script>`, cierra el bloque y ejecuta JS arbitrario para
 * TODO visitante anónimo de la página (XSS almacenado de segundo orden). Escapar
 * esos tres caracteres a su forma `\\uXXXX` neutraliza el breakout sin romper el
 * JSON (los parsers de Google lo interpretan idéntico).
 *
 * Uso:
 *   <script type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: safeJsonLd(obj) }} />
 */
export function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export type JsonLdBrand = 'constructora' | 'barraca';

interface BrandConfig {
  url: string;
  localBusinessName: string;
  localBusinessDescription: string;
  /** El tipo de LocalBusiness más específico — afecta cómo Google clasifica el negocio. */
  localBusinessType: 'LocalBusiness' | 'HardwareStore';
}

const BRAND_CONFIG: Record<JsonLdBrand, BrandConfig> = {
  constructora: {
    url: 'https://jurmaq.cl',
    localBusinessName: 'JURMAQ — Arriendo de Maquinaria y Constructora',
    localBusinessDescription:
      'Constructora industrial, arriendo de maquinaria pesada (retroexcavadoras, miniexcavadoras, brazos articulados), maestranza y obras civiles en Curicó y Región del Maule.',
    localBusinessType: 'LocalBusiness',
  },
  barraca: {
    url: 'https://barraca.jurmaq.cl',
    localBusinessName: 'JURMAQ Barraca — Fierros y Materiales de Construcción',
    localBusinessDescription:
      'Barraca de fierros, perfiles, planchas, tubos, mallas Acma, pinturas y materiales de construcción con despacho en Curicó, Molina y toda la Región del Maule.',
    localBusinessType: 'HardwareStore',
  },
};

/**
 * Ciudades servidas — comunes para ambos brands (operamos en la misma zona).
 * Usado en `Organization.areaServed`.
 */
const AREA_SERVED = [
  { '@type': 'City', name: 'Curicó' },
  { '@type': 'City', name: 'Molina' },
  { '@type': 'City', name: 'Teno' },
  { '@type': 'City', name: 'Romeral' },
  { '@type': 'City', name: 'Sagrada Familia' },
  { '@type': 'City', name: 'Hualañé' },
  { '@type': 'City', name: 'Licantén' },
  { '@type': 'City', name: 'Vichuquén' },
  { '@type': 'City', name: 'Rauco' },
  { '@type': 'City', name: 'Talca' },
  { '@type': 'City', name: 'Linares' },
  { '@type': 'AdministrativeArea', name: 'Región del Maule' },
] as const;

/**
 * Construye el `@graph` con Organization + LocalBusiness + WebSite para
 * inyectar como JSON-LD en el `<head>` del root layout.
 *
 * Notar:
 * - Address/geo/telefono salen de `LEGAL_INFO.brands[brand]` — single source of truth.
 * - El logo siempre es `/icon-512.png` (asset deployado en cada dominio).
 * - `openingHoursSpecification` está hardcoded acá (lunes-viernes 08:30-18:30,
 *   sábado 09:00-14:00). Si cambian los horarios, editar solo este archivo.
 *   OJO: decía 18:00 mientras la barra superior del sitio y la página de
 *   ubicación mostraban 18:30. Se alineó al horario que ve el cliente en
 *   pantalla; si el correcto fuera 18:00, hay que cambiar los tres lugares.
 */
export function buildJsonLdGraph(brand: JsonLdBrand): Record<string, unknown> {
  const config = BRAND_CONFIG[brand];
  const brandData = LEGAL_INFO.brands[brand];
  const baseUrl = config.url;

  const postalAddress = {
    '@type': 'PostalAddress',
    streetAddress: brandData.streetAddress,
    addressLocality: brandData.addressLocality,
    addressRegion: brandData.addressRegion,
    addressCountry: brandData.addressCountry,
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}/#organization`,
        name: LEGAL_INFO.nombreComercial,
        legalName: LEGAL_INFO.nombreLegal,
        url: baseUrl,
        logo: `${baseUrl}/icon-512.png`,
        image: `${baseUrl}/icon-512.png`,
        email: 'contacto@jurmaq.cl',
        telephone: brandData.telefono,
        description: config.localBusinessDescription,
        address: postalAddress,
        areaServed: AREA_SERVED,
        sameAs: ['https://www.instagram.com/jurmaq.cl'],
      },
      {
        '@type': config.localBusinessType,
        '@id': `${baseUrl}/#localbusiness`,
        name: config.localBusinessName,
        url: baseUrl,
        image: `${baseUrl}/icon-512.png`,
        telephone: brandData.telefono,
        priceRange: '$$',
        address: postalAddress,
        geo: {
          '@type': 'GeoCoordinates',
          latitude: brandData.geo.latitude,
          longitude: brandData.geo.longitude,
        },
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            opens: '08:30',
            closes: '18:30',
          },
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: 'Saturday',
            opens: '09:00',
            closes: '14:00',
          },
        ],
        areaServed: { '@type': 'AdministrativeArea', name: 'Región del Maule, Chile' },
        parentOrganization: { '@id': `${baseUrl}/#organization` },
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        url: baseUrl,
        name: config.localBusinessName,
        publisher: { '@id': `${baseUrl}/#organization` },
        inLanguage: 'es-CL',
      },
    ],
  };
}
