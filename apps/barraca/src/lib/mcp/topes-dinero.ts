/**
 * TOPES DUROS de volumen de las operaciones de DINERO y BORRADO por MCP (scope `tienda:dinero`).
 *
 * Qué resuelven: aunque Jorge decidió el modo «solo aviso» (no hay aprobación previa por correo), un texto de un cliente
 * podría inducir a un agente a encadenar vista previa y confirmación muchas veces. Estos topes frenan el DAÑO MÁXIMO:
 * pasado el tope la herramienta rechaza («tope de seguridad; hágalo desde el panel»), no ejecuta nada y avisa a Jorge del
 * intento por correo.
 *
 * Reglas:
 *  - Son iguales en los modos `exigir` y `avisar`. Ninguna herramienta, esquema ni variable los cambia: SOLO se editan acá
 *    (y hay que volver a publicar). Una prueba vigila que ningún esquema de herramienta hable de ellos.
 *  - Son por USUARIO (la cuenta de la conexión). El contador vive en la D1 de gestión (tabla `operaciones_dinero`, migración
 *    0012) y la reserva es atómica: dos llamadas a la vez no pasan el tope.
 *  - Fallan CERRADO: si no se puede leer o escribir el contador, la operación no se hace.
 *  - Una operación cuenta cuando se CONFIRMA (la vista previa no cuenta) y sigue contando aunque después falle: un bucle de
 *    intentos fallidos también se frena.
 *
 * Valores pensados para una barraca pequeña (pocos pedidos al día). Si Jorge necesita más, que cambie estos números.
 */
import type { D1Like } from "../gestion/tipos.ts";
import { idUuid } from "../gestion/util.ts";

export const TOPES_DINERO = {
  /** Operaciones de dinero o borrado por usuario en una hora (incluye las devoluciones). */
  operacionesPorHora: 10,
  /** Operaciones de dinero o borrado por usuario en 24 horas. */
  operacionesPor24h: 30,
  /** Cancelaciones con devolución por usuario en una hora. */
  devolucionesPorHora: 5,
  /** Pesos devueltos acumulados por usuario en 24 horas ($1.000.000). */
  montoDevueltoPor24h: 1_000_000,
  /** Cuánto dura el id de una vista previa de dinero o borrado. */
  vistaPreviaDuraMs: 10 * 60 * 1000,
  /** Espera mínima entre la vista previa y su confirmación (nunca en la misma llamada ni pegadas). */
  esperaMinimaConfirmacionMs: 8 * 1000,
} as const;

/**
 * Decisión pendiente de Jorge: exigir su aprobación POR CORREO antes de cancelar un pedido pagado con devolución.
 * Hoy está en `false` (modo «solo aviso»: se avisa después, no se espera su OK). Poner `true` HOY hace que
 * `confirmar_cancelar_pedido_pagado` rechace siempre («hágalo desde el panel») porque el flujo de aprobación por correo
 * de esta operación todavía no está construido: falla cerrado a propósito. El punto de enganche es `confirmarCancelar`
 * en `tools/dinero.ts` (busca esta constante); ahí se conectaría `exigirAprobacion`.
 */
export const APROBACION_CORREO_CANCELAR_PAGADO = false;

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

export type MotivoTope = "operaciones_hora" | "operaciones_dia" | "devoluciones_hora" | "monto_devuelto_dia" | "sin_contador";

export type ResultadoTope = { ok: true; id: string } | { ok: false; motivo: MotivoTope; mensaje: string };

export const TEXTO_TOPE: Record<MotivoTope, string> = {
  operaciones_hora: `se llegó al máximo de ${TOPES_DINERO.operacionesPorHora} operaciones de dinero o borrado en una hora`,
  operaciones_dia: `se llegó al máximo de ${TOPES_DINERO.operacionesPor24h} operaciones de dinero o borrado en 24 horas`,
  devoluciones_hora: `se llegó al máximo de ${TOPES_DINERO.devolucionesPorHora} devoluciones en una hora`,
  monto_devuelto_dia: `se llegaría a más de $${TOPES_DINERO.montoDevueltoPor24h.toLocaleString("es-CL")} devueltos en 24 horas`,
  sin_contador: "no pude comprobar los topes de seguridad",
};

/** Texto para quien llamó; la línea sobre el aviso a Jorge se agrega aparte (dinero-comun.ts), según haya salido o no. */
export const mensajeTope = (m: MotivoTope) =>
  m === "sin_contador"
    ? "Tope de seguridad: no pude comprobar cuántas operaciones de dinero se hicieron hoy, y sin eso no se hace ninguna. No se hizo nada; hágalo desde el panel o intente de nuevo en un momento."
    : `Tope de seguridad: ${TEXTO_TOPE[m]}. No se hizo nada; hágalo desde el panel.`;

/**
 * Reserva un cupo ANTES de ejecutar la operación (un solo INSERT condicional: atómico). `esDevolucion` + `monto` cuentan
 * además para los topes de devoluciones. Nunca lanza: si D1 falla devuelve `sin_contador` (la operación NO se hace).
 */
export async function reservarCupoDinero(
  db: D1Like, d: { usuarioId: string; herramienta: string; esDevolucion?: boolean; monto?: number; ahora: number },
): Promise<ResultadoTope> {
  const dev = d.esDevolucion ? 1 : 0;
  const monto = d.esDevolucion ? Math.max(0, Math.round(d.monto ?? 0)) : 0;
  const id = idUuid();
  try {
    const r = await db
      .prepare(
        `INSERT INTO operaciones_dinero (id, usuario_id, herramienta, es_devolucion, monto, creado_en)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6
          WHERE (SELECT COUNT(*) FROM operaciones_dinero WHERE usuario_id = ?2 AND creado_en > ?6 - ${HORA}) < ?7
            AND (SELECT COUNT(*) FROM operaciones_dinero WHERE usuario_id = ?2 AND creado_en > ?6 - ${DIA}) < ?8
            AND (?4 = 0 OR (SELECT COUNT(*) FROM operaciones_dinero WHERE usuario_id = ?2 AND es_devolucion = 1 AND creado_en > ?6 - ${HORA}) < ?9)
            AND (?4 = 0 OR (SELECT COALESCE(SUM(monto), 0) FROM operaciones_dinero WHERE usuario_id = ?2 AND es_devolucion = 1 AND creado_en > ?6 - ${DIA}) + ?5 <= ?10)`,
      )
      .bind(id, d.usuarioId, d.herramienta.slice(0, 64), dev, monto, d.ahora, TOPES_DINERO.operacionesPorHora, TOPES_DINERO.operacionesPor24h, TOPES_DINERO.devolucionesPorHora, TOPES_DINERO.montoDevueltoPor24h)
      .run();
    if ((r.meta?.changes ?? 0) > 0) {
      // Limpieza barata de lo que ya no cuenta (más de 2 días).
      await db.prepare("DELETE FROM operaciones_dinero WHERE creado_en < ?").bind(d.ahora - 2 * DIA).run().catch(() => undefined);
      return { ok: true, id };
    }
    const cuenta = async (sql: string, ...p: unknown[]) => (await db.prepare(sql).bind(...p).first<{ n: number }>())?.n ?? 0;
    const hora = await cuenta("SELECT COUNT(*) AS n FROM operaciones_dinero WHERE usuario_id = ? AND creado_en > ?", d.usuarioId, d.ahora - HORA);
    const dia = await cuenta("SELECT COUNT(*) AS n FROM operaciones_dinero WHERE usuario_id = ? AND creado_en > ?", d.usuarioId, d.ahora - DIA);
    let motivo: MotivoTope = "operaciones_hora";
    if (hora >= TOPES_DINERO.operacionesPorHora) motivo = "operaciones_hora";
    else if (dia >= TOPES_DINERO.operacionesPor24h) motivo = "operaciones_dia";
    else if (dev) {
      const devH = await cuenta("SELECT COUNT(*) AS n FROM operaciones_dinero WHERE usuario_id = ? AND es_devolucion = 1 AND creado_en > ?", d.usuarioId, d.ahora - HORA);
      motivo = devH >= TOPES_DINERO.devolucionesPorHora ? "devoluciones_hora" : "monto_devuelto_dia";
    }
    return { ok: false, motivo, mensaje: mensajeTope(motivo) };
  } catch {
    return { ok: false, motivo: "sin_contador", mensaje: mensajeTope("sin_contador") };
  }
}
