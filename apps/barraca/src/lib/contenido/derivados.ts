/**
 * Datos derivados de DatosLocal (la fuente única): textos de horario, enlaces
 * de WhatsApp/teléfono/mapa y los campos de schema.org. Puro.
 */
import { armarHorario, type HorarioTextos } from "./horario.ts";
import type { DatosLocal } from "./tipos.ts";

export interface VistaLocal extends DatosLocal {
  h: HorarioTextos;
  /** https://wa.me/<numero> (sin texto). */
  whatsappUrl: string;
  /** tel:+56... */
  telUrl: string;
  /** Búsqueda en Google Maps (página de contacto). */
  mapaUrl: string;
  /** "Cómo llegar" del pie. */
  comoLlegarUrl: string;
  /** "Av. Poniente 2157, Molina". */
  direccionCorta: string;
}

export function vistaLocal(d: DatosLocal): VistaLocal {
  const consulta = encodeURIComponent(`${d.calle}, ${d.comuna}, Chile`);
  return {
    ...d,
    h: armarHorario(d.horario),
    whatsappUrl: `https://wa.me/${d.whatsapp}`,
    telUrl: `tel:${d.telefono}`,
    mapaUrl: `https://www.google.com/maps/search/?api=1&query=${consulta}`,
    comoLlegarUrl: `https://www.google.com/maps/dir/?api=1&destination=${consulta}`,
    direccionCorta: `${d.calle}, ${d.comuna}`,
  };
}

type Registro = Record<string, unknown>;

/**
 * Reemplaza en el grafo schema.org de la tienda (buildJsonLdGraph('barraca'))
 * los datos que vienen de DatosLocal. Si algo del grafo no tiene la forma
 * esperada se deja tal cual.
 */
export function aplicarDatosAJsonLd(grafo: Record<string, unknown>, d: DatosLocal): Record<string, unknown> {
  const lista = grafo["@graph"];
  if (!Array.isArray(lista)) return grafo;
  const direccion = {
    "@type": "PostalAddress",
    streetAddress: d.calle,
    addressLocality: d.comuna,
    addressRegion: d.region,
    addressCountry: "CL",
  };
  const horario = armarHorario(d.horario).openingHoursSpecification;
  const nuevo = lista.map((n) => {
    if (!n || typeof n !== "object") return n;
    const nodo = n as Registro;
    if (nodo["@type"] === "Organization") {
      return {
        ...nodo,
        name: d.nombre,
        legalName: d.razonSocial,
        taxID: d.rut,
        email: d.email,
        telephone: d.telefono,
        address: direccion,
        ...(d.instagram ? { sameAs: [d.instagram] } : {}),
      };
    }
    if (nodo["@type"] === "LocalBusiness" || nodo["@type"] === "HardwareStore") {
      return {
        ...nodo,
        telephone: d.telefono,
        address: direccion,
        geo: { "@type": "GeoCoordinates", latitude: d.geo.lat, longitude: d.geo.lng },
        openingHoursSpecification: horario,
      };
    }
    return nodo;
  });
  return { ...grafo, "@graph": nuevo };
}
