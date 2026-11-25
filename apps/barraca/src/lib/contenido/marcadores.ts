/**
 * Marcadores {{...}} de los documentos editables (envíos, nosotros): se
 * reemplazan por los datos del local y de la tienda al mostrar la página, para
 * que el texto no repita teléfonos ni direcciones. Puro.
 */
import { armarHorario } from "./horario.ts";
import type { DatosLocal } from "./tipos.ts";

export interface ValoresMarcadores {
  lugaresDespacho: string;
}

export function valoresDeMarcadores(local: DatosLocal, extra: ValoresMarcadores): Record<string, string> {
  return {
    razon_social: local.razonSocial,
    rut: local.rut,
    direccion: local.direccion,
    direccion_corta: `${local.calle}, ${local.comuna}`,
    telefono: local.telefonoDisplay,
    whatsapp: local.telefonoDisplay,
    email: local.email,
    horario: armarHorario(local.horario).texto,
    lugares_despacho: extra.lugaresDespacho,
  };
}

/** Reemplaza {{clave}}. `tarifas` no se toca (la página pone ahí la tabla). Desconocidos quedan vacíos. */
export function sustituirMarcadores(md: string, valores: Record<string, string>): string {
  return md.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k: string) => (k === "tarifas" ? "{{tarifas}}" : (valores[k] ?? "")));
}
