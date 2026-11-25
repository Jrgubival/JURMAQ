/**
 * MODO DE APROBACIÓN: un solo interruptor, en un solo lugar de lectura.
 *
 *  - `exigir` (por defecto): lo riesgoso espera el OK de Jorge por correo (el comportamiento de siempre).
 *  - `avisar`: lo riesgoso se aplica tras vista previa + confirmar en DOS llamadas, y después a Jorge le llega un
 *    correo de aviso con qué cambió y el enlace a /admin/conexiones para deshacer. Los topes duros (precio 0 o
 *    negativo, venta bajo el 50 % del costo, datos bancarios y enlaces de pago) NO dependen del modo.
 *
 * Reglas de seguridad (hay una prueba que las vigila):
 *  - Se lee SOLO de la variable de entorno / secreto del worker `BARRACA_MODO_APROBACION`. NUNCA de D1.
 *  - Ausente, vacía o con cualquier valor que no sea exactamente `avisar` (sin contar espacios) = `exigir`. Falla cerrada.
 *  - Ninguna herramienta MCP, ni el deshacer, ni el panel, ni ninguna ruta escribe ni cambia esa variable: solo se
 *    cambia desde la configuración del worker (`wrangler secret put BARRACA_MODO_APROBACION`).
 *  - Se lee en CADA operación (no se guarda en caché): cambiar el secreto surte efecto en la siguiente llamada.
 *
 * Esta es la ÚNICA lectura. Quien necesite el modo importa `leerModoAprobacion` de aquí.
 */

export type ModoAprobacion = "exigir" | "avisar";

export const NOMBRE_VARIABLE_MODO = "BARRACA_MODO_APROBACION";

type Entorno = Record<string, string | undefined>;

/** El modo vigente AHORA. `env` solo se pasa en pruebas; en producción es `process.env` del worker. */
export function leerModoAprobacion(env?: Entorno): ModoAprobacion {
  let valor: string | undefined;
  try {
    valor = (env ?? (typeof process !== "undefined" ? (process.env as Entorno) : {}))[NOMBRE_VARIABLE_MODO];
  } catch {
    return "exigir";
  }
  return typeof valor === "string" && valor.trim() === "avisar" ? "avisar" : "exigir";
}
