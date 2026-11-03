import { LEGAL_INFO } from "@jurmaq/shared/seo";

export const SITIO_URL = "https://constructora.jurmaq.cl";

/** Fecha real de la última edición del contenido. Alimenta el sitemap. */
export const ACTUALIZADO = "2026-11-03";

const marca = LEGAL_INFO.brands.constructora;

export const EMPRESA = {
  nombre: marca.nombre,
  razonSocial: LEGAL_INFO.nombreLegal,
  rut: LEGAL_INFO.rut,
  direccion: marca.direccion,
  streetAddress: marca.streetAddress,
  comuna: marca.addressLocality,
  region: marca.addressRegion,
  pais: marca.addressCountry,
  telefono: marca.telefono,
  telefonoVisible: marca.telefonoDisplay,
  whatsapp: marca.whatsapp,
  correo: "constructora@jurmaq.cl",
} as const;

/** Destino del formulario. Vive en la app de jurmaq.cl, este sitio es estático. */
export const API_SOLICITUDES = "https://jurmaq.cl/api/solicitudes";

export function url(ruta = "/"): string {
  return ruta === "/" ? SITIO_URL : `${SITIO_URL}${ruta}`;
}

export const ORGANIZACION_ID = `${SITIO_URL}/#organizacion`;
