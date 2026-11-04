import { SITIO } from './sitio';
import type { Maquina, Unidad } from './maquinas';

export const NEGOCIO_ID = `${SITIO.url}/#negocio`;

export const proveedor = { '@type': 'LocalBusiness', '@id': NEGOCIO_ID, name: SITIO.nombre, url: SITIO.url };

const CODIGO_UNIDAD: Record<Unidad, string> = { hora: 'HUR', dia: 'DAY', semana: 'WEE', mes: 'MON' };

export function jsonLdNegocio(comunas: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': NEGOCIO_ID,
    name: SITIO.nombre,
    legalName: SITIO.razonSocial,
    taxID: SITIO.rut,
    url: SITIO.url,
    telephone: SITIO.telefono,
    email: SITIO.correo,
    foundingDate: String(SITIO.anioInicio),
    address: {
      '@type': 'PostalAddress',
      streetAddress: SITIO.calle,
      addressLocality: SITIO.comuna,
      addressRegion: SITIO.region,
      addressCountry: 'CL',
    },
    geo: { '@type': 'GeoCoordinates', ...SITIO.geo },
    areaServed: [
      { '@type': 'AdministrativeArea', name: SITIO.region },
      ...comunas.map((name) => ({ '@type': 'City', name })),
    ],
  };
}

const MARCAS: [RegExp, string][] = [[/HMK|Hidromek/i, 'Hidromek'], [/XCMG/i, 'XCMG'], [/Bobcat/i, 'Bobcat'], [/JLG/i, 'JLG'], [/Fullen/i, 'Fullen'], [/Genie/i, 'Genie'], [/\bVW\b/i, 'Volkswagen']];

export function jsonLdFicha(m: Maquina, url: string) {
  const marca = MARCAS.find(([r]) => r.test(m.nombre))?.[1];
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: m.nombre,
    url,
    description: m.descripcion || `${m.nombre} en arriendo en la Región del Maule.`,
    ...(marca ? { brand: { '@type': 'Brand', name: marca } } : {}),
    // Una imagen referencial no es de este producto.
    ...(m.fotos[0] && !m.fotoReferencial ? { image: `${m.fotos[0].startsWith('http') ? '' : SITIO.url}${m.fotos[0]}` } : {}),
    ...(m.precios.length > 0
      ? {
          offers: m.precios.map((p) => ({
            '@type': 'Offer',
            url,
            price: p.valor,
            priceCurrency: 'CLP',
            // Arriendo, no venta.
            businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
            availability: m.estado === 'disponible' ? 'https://schema.org/InStock' : 'https://schema.org/LimitedAvailability',
            seller: proveedor,
            priceSpecification: {
              '@type': 'UnitPriceSpecification',
              price: p.valor,
              priceCurrency: 'CLP',
              valueAddedTaxIncluded: false,
              unitCode: CODIGO_UNIDAD[p.unidad],
            },
          })),
        }
      : {}),
  };
}

export function jsonLdServicio(nombre: string, descripcion: string, url: string, area: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: nombre,
    description: descripcion,
    url,
    provider: proveedor,
    areaServed: { '@type': 'AdministrativeArea', name: area },
  };
}
