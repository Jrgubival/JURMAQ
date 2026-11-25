/**
 * Piezas puras para las herramientas de correos: huella de lo que se publicaría, diferencias por campo
 * y los textos que ve Jorge al aprobar. Sin Next, sin Supabase y sin envío de correos.
 */
import { huellaDeDatos } from "../gestion/util.ts";
import { PLANTILLAS, type ClaveCorreo } from "./plantillas.ts";
import { campoComoTexto, variablesEjemplo, vistaPreviaTexto } from "./render.ts";
import type { EstadoCorreo, Textos } from "./repositorio.ts";

/**
 * Huella de lo que se va a publicar: el borrador exacto, lo que se envía hoy y la versión vigente.
 * Si cualquiera cambia entre la vista previa, la aprobación y la publicación, no coincide y no se publica.
 */
export function huellaPublicacion(est: Pick<EstadoCorreo, "clave" | "borrador" | "efectivo" | "versionPublicada" | "origen">): Promise<string> {
  return huellaDeDatos({ clave: est.clave, borrador: est.borrador, efectivo: est.efectivo, version: est.origen === "d1" ? est.versionPublicada : 0 });
}

export interface CambioCampo { campo: string; etiqueta: string; antes: string; despues: string }

export function diferenciasCampos(clave: ClaveCorreo, antes: Textos, despues: Textos): CambioCampo[] {
  return PLANTILLAS[clave].campos
    .filter((c) => (antes[c.clave] ?? "") !== (despues[c.clave] ?? ""))
    .map((c) => ({ campo: c.clave, etiqueta: c.etiqueta, antes: antes[c.clave] ?? "", despues: despues[c.clave] ?? "" }));
}

export const vistaConEjemplo = (clave: ClaveCorreo, textos: Textos) => vistaPreviaTexto(clave, textos, variablesEjemplo(clave));

const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Resumen corto para el correo de aprobación: asunto y saludo ya armados con datos de ejemplo. */
export function resumenParaAprobador(clave: ClaveCorreo, despues: Textos, cambios: CambioCampo[]): string {
  const def = PLANTILLAS[clave];
  const ej = variablesEjemplo(clave);
  const asunto = campoComoTexto(clave, despues, ej, "asunto");
  const campoSaludo = def.campos.find((c) => c.tipo === "parrafo")?.clave;
  const saludo = campoSaludo ? campoComoTexto(clave, despues, ej, campoSaludo) : "";
  return corto(
    `Cambiar el texto del correo «${def.titulo}» que reciben los clientes (${cambios.map((c) => c.etiqueta.toLowerCase()).join(", ")}). Con datos de ejemplo queda así. Asunto: «${asunto}».${saludo ? ` Primer párrafo: «${saludo}».` : ""} El detalle completo está en la página de aprobación.`,
    700,
  );
}
