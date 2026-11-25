/**
 * TOPES DUROS de precios. Valen en AMBOS modos de aprobación (exigir y avisar) y NO se pueden aprobar: ni con el OK de
 * Jorge ni avisándole. Se manifiestan como un ERROR claro de la herramienta (`ErrorTopeDuro`), no como una aprobación
 * pendiente, y no cambian nada.
 *
 *  1. Ningún precio a $0 ni negativo (ni el de venta ni el unitario de un combo).
 *  2. Ningún precio de venta por debajo del 50 % del costo, cuando el costo está cargado. Sin costo no hay tope aquí: una
 *     baja de precio sin costo sigue la regla de siempre (`sin_costo_baja`, pide el OK o aviso).
 *
 * Se aplica dentro de `evaluarCambioPrecios` (reglas.ts), el centro de reglas que usan TODAS las herramientas que
 * cambian precios (editar_producto, crear_producto, precios masivos, ofertas y el deshacer con reglas): nadie se lo salta
 * usando otra herramienta. Los datos bancarios y enlaces de pago intocables viven en contenido/datos-pago.ts.
 */
import { ErrorHerramienta } from "../mcp/tools/registro.ts";

/** Fracción mínima del costo: bajo ella no se vende (0,5 = 50 %). */
export const TOPE_MINIMO_SOBRE_COSTO = 0.5;

/** Un tope duro: se muestra tal cual a quien llama (hereda de ErrorHerramienta, que el servidor sí deja pasar). */
export class ErrorTopeDuro extends ErrorHerramienta {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorTopeDuro";
  }
}

export interface PrecioARevisar {
  clave: string;
  precio: number;
  costo?: number | null;
  /** Este precio no cambia respecto de hoy (se está tocando otro dato): solo se revisa si es cero o negativo. */
  sinCambio?: boolean;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** Los incumplimientos de los topes duros, en palabras (vacío = todo bien). */
export function incumplimientosTopes(precios: PrecioARevisar[]): string[] {
  const fuera: string[] = [];
  for (const { clave, precio, costo, sinCambio } of precios) {
    if (!Number.isFinite(precio) || precio <= 0) {
      fuera.push(`${clave}: un precio de ${Number.isFinite(precio) ? pesos(precio) : "valor no válido"} (el precio no puede ser 0 ni negativo)`);
      continue;
    }
    if (sinCambio) continue;
    if (typeof costo === "number" && Number.isFinite(costo) && costo > 0 && precio < costo * TOPE_MINIMO_SOBRE_COSTO) {
      fuera.push(`${clave}: ${pesos(precio)} queda bajo el 50 % de su costo (${pesos(costo)}; el mínimo sería ${pesos(Math.ceil(costo * TOPE_MINIMO_SOBRE_COSTO))})`);
    }
  }
  return fuera;
}

/** Lanza `ErrorTopeDuro` si algún precio incumple un tope duro. Ver el comentario del archivo. */
export function exigirTopesDuros(precios: PrecioARevisar[]): void {
  const fuera = incumplimientosTopes(precios);
  if (fuera.length === 0) return;
  const lista = fuera.slice(0, 5).join("; ");
  const mas = fuera.length > 5 ? `; y ${fuera.length - 5} más` : "";
  throw new ErrorTopeDuro(
    `No se puede: ${lista}${mas}. Es un tope duro de la tienda (precio mayor que 0 y no menos del 50 % del costo): no se aprueba ni con el OK de Jorge ni en modo avisar. No se cambió nada. Corrige el precio o el costo y vuelve a intentar.`,
  );
}
