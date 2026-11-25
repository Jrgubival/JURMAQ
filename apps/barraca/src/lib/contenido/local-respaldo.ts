/**
 * Respaldo en código de los datos del local (liviano: sin los textos legales).
 * Parte de las constantes compartidas (@jurmaq/shared/seo: HQ, LEGAL_INFO,
 * HORARIO_BARRACA). Lo usan el navegador (contexto de la tienda) y respaldo.ts.
 */
import { HORARIO_BARRACA, HQ, LEGAL_INFO } from "@jurmaq/shared/seo";
import { DIAS_SEMANA, type DatosLocal, type DiaSemana, type HorarioSemanal } from "./tipos.ts";

const DIA_DESDE_SCHEMA: Record<string, DiaSemana> = {
  Monday: "lunes",
  Tuesday: "martes",
  Wednesday: "miercoles",
  Thursday: "jueves",
  Friday: "viernes",
  Saturday: "sabado",
  Sunday: "domingo",
};

function horarioRespaldo(): HorarioSemanal {
  const h = Object.fromEntries(DIAS_SEMANA.map((d) => [d, []])) as unknown as HorarioSemanal;
  for (const spec of HORARIO_BARRACA.openingHoursSpecification) {
    for (const dia of spec.dayOfWeek) h[DIA_DESDE_SCHEMA[dia]].push({ abre: spec.opens, cierra: spec.closes });
  }
  return h;
}

export function datosLocalRespaldo(): DatosLocal {
  const b = LEGAL_INFO.brands.barraca;
  return {
    nombre: b.nombre,
    razonSocial: b.razonSocial,
    rut: b.rut,
    direccion: b.direccion,
    calle: b.streetAddress,
    comuna: b.addressLocality,
    region: b.addressRegion,
    codigoPostal: b.postalCode,
    telefono: b.telefono,
    telefonoDisplay: b.telefonoDisplay,
    whatsapp: b.whatsapp.replace("https://wa.me/", ""),
    email: HQ.email,
    instagram: b.instagram,
    geo: { lat: b.geo.latitude, lng: b.geo.longitude },
    horario: horarioRespaldo(),
  };
}

/** Descripción del pie de la tienda (textos.pieDescripcion de respaldo). */
export const PIE_DESCRIPCION_RESPALDO =
  "Fierros y materiales de construcción en Molina. Retiro en el local o despacho a domicilio en Molina, Curicó, Talca y alrededores.";
