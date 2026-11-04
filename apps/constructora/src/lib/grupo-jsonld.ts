import { CONTACTO_GRUPO, NEGOCIOS, URL_HUB, type Negocio } from '@jurmaq/shared/ui/grupo';

/**
 * JSON-LD del hub. "Grupo JURMAQ" es una marca, así que no lleva `legalName` ni
 * `taxID`: esos datos van en cada negocio, con los suyos. Sin `LocalBusiness`
 * acá: la ficha local vive en el sitio de cada negocio.
 */
export function grafoGrupo() {
  const negocios = (Object.keys(NEGOCIOS) as Negocio[]).map((clave) => {
    const n = NEGOCIOS[clave];
    return {
      '@type': 'Organization',
      '@id': `${n.url}/#organization`,
      name: `JURMAQ ${n.nombre}`,
      legalName: n.razonSocial,
      taxID: n.rut,
      url: n.url,
      telephone: n.telefono,
      address: {
        '@type': 'PostalAddress',
        streetAddress: n.direccion,
        addressRegion: 'Región del Maule',
        addressCountry: 'CL',
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${URL_HUB}/#organization`,
        name: 'Grupo JURMAQ',
        url: URL_HUB,
        logo: `${URL_HUB}/icon-512.png`,
        email: CONTACTO_GRUPO,
        foundingDate: '2000',
        subOrganization: negocios.map((n) => ({ '@id': n['@id'] })),
      },
      ...negocios,
      {
        '@type': 'WebSite',
        '@id': `${URL_HUB}/#website`,
        url: URL_HUB,
        name: 'Grupo JURMAQ',
        inLanguage: 'es-CL',
        publisher: { '@id': `${URL_HUB}/#organization` },
      },
    ],
  };
}
