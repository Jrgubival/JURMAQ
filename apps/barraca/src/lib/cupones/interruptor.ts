import { registrarCambio } from "../gestion/auditoria.ts";
import type { D1Like, UsuarioGestion } from "../gestion/tipos.ts";

/**
 * Interruptor de cupones en el checkout. APAGADO por defecto: sin fila en la
 * tabla `ajustes` (o con cualquier error leyéndola) los cupones NO se aplican y
 * la tienda se comporta como antes. Encenderlo exige la aprobación de Jorge.
 */

export const CLAVE_INTERRUPTOR_CUPONES = "cupones_checkout";

export async function leerInterruptorCupones(db: D1Like): Promise<boolean> {
  const f = await db.prepare("SELECT valor FROM ajustes WHERE clave = ?").bind(CLAVE_INTERRUPTOR_CUPONES).first<{ valor: string }>();
  return f?.valor === "1";
}

export interface SolicitudAprobacion {
  accion: "encender_interruptor_cupones";
  /** Texto para mostrar a quien aprueba. */
  resumen: string;
  usuario: UsuarioGestion;
}
export type RespuestaAprobacion = boolean | { aprobada: boolean; aprobacionId?: string };
/** Lo implementa el servicio de aprobaciones (otra pieza): pide el visto bueno de Jorge y devuelve su respuesta. */
export type HookAprobacion = (solicitud: SolicitudAprobacion) => Promise<RespuestaAprobacion>;

export type ResultadoEncender =
  | { ok: true; aprobacionId: string | null }
  | { ok: false; motivo: "no_aprobado" | "esquema_incompleto" };

export interface OpcionesEncender {
  usuario: UsuarioGestion;
  /** OBLIGATORIO. Sin aprobación no se enciende. */
  aprobar: HookAprobacion;
  /**
   * Comprueba que la base de pedidos ya tiene las columnas del cupón
   * (supabase/migrations/2026_11_26_barraca_cupones_pedidos.sql). Si devuelve
   * false no se enciende: con el cupón puesto, crear pedidos fallaría.
   */
  verificarEsquema: () => Promise<boolean>;
  ahora?: number;
}

export async function encenderInterruptorCupones(db: D1Like, opciones: OpcionesEncender): Promise<ResultadoEncender> {
  if (!opciones || typeof opciones.aprobar !== "function") {
    throw new Error("encenderInterruptorCupones requiere un hook de aprobación (aprobar).");
  }
  if (typeof opciones.verificarEsquema !== "function") throw new Error("encenderInterruptorCupones requiere verificarEsquema.");
  if (!opciones.usuario?.id) throw new Error("encenderInterruptorCupones requiere un usuario.");

  if (!(await opciones.verificarEsquema())) return { ok: false, motivo: "esquema_incompleto" };

  const r = await opciones.aprobar({
    accion: "encender_interruptor_cupones",
    resumen: "Encender los cupones de descuento en el checkout de la tienda. Los cupones existentes empezarán a aplicarse a los pedidos.",
    usuario: opciones.usuario,
  });
  const aprobada = typeof r === "boolean" ? r : r?.aprobada === true;
  if (!aprobada) return { ok: false, motivo: "no_aprobado" };
  const aprobacionId = typeof r === "object" && r?.aprobacionId ? String(r.aprobacionId) : null;
  await escribir(db, true, opciones.usuario, opciones.ahora ?? Date.now(), aprobacionId);
  return { ok: true, aprobacionId };
}

/** Apagar es siempre seguro: no pide aprobación. */
export async function apagarInterruptorCupones(db: D1Like, usuario: UsuarioGestion, ahora = Date.now()): Promise<void> {
  await escribir(db, false, usuario, ahora, null);
}

async function escribir(db: D1Like, encendido: boolean, usuario: UsuarioGestion, ahora: number, aprobacionId: string | null) {
  const antes = await leerInterruptorCupones(db);
  await db
    .prepare(
      `INSERT INTO ajustes (clave, valor, actualizado_en, actualizado_por) VALUES (?, ?, ?, ?)
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = excluded.actualizado_en, actualizado_por = excluded.actualizado_por`,
    )
    .bind(CLAVE_INTERRUPTOR_CUPONES, encendido ? "1" : "0", ahora, usuario.id)
    .run();
  await registrarCambio(
    db,
    usuario,
    {
      herramienta: encendido ? "cupones.encender_interruptor" : "cupones.apagar_interruptor",
      entidad: "ajuste",
      entidadId: CLAVE_INTERRUPTOR_CUPONES,
      antes: { encendido: antes },
      despues: { encendido, aprobacionId },
    },
    { ahora },
  );
}
