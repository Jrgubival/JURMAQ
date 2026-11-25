import type { D1Like } from "../gestion/tipos.ts";
import { calcularCupon, type LineaCupon, type ResultadoCalculo } from "./calculo.ts";
import { leerInterruptorCupones } from "./interruptor.ts";
import { huellaCliente, normalizarEmail, normalizarRut } from "./normalizar.ts";
import { contarUsos, reservarUsoCupon, type ResultadoReserva } from "./reservas.ts";
import { leerReglas, type ReglasCupon } from "./reglas.ts";

/**
 * Aplicación de un cupón en el checkout. TODO el cálculo es del servidor.
 * Falla cerrado: sin interruptor encendido, sin la D1 de gestión o con cualquier
 * error, el cupón NO se aplica y el pedido sin cupón sigue funcionando.
 */

export interface CuponRegistro {
  id: string;
  codigo: string;
  descripcion: string | null;
  tipo: "porcentaje" | "monto_fijo";
  valor: number;
  monto_minimo_compra: number;
  max_usos_total: number | null;
  max_usos_por_usuario: number;
  usos_actuales: number;
  valido_desde: string | null;
  valido_hasta: string | null;
  activo: boolean;
}

/** Lo que el servicio necesita de Supabase (inyectable para pruebas). */
export interface RepoCupones {
  buscarPorCodigo(codigo: string): Promise<CuponRegistro | null>;
  /** Usos antiguos (flujo de cotizaciones) de este correo, para no saltarse el límite. */
  usosAntiguosDeCorreo(cuponId: string, email: string): Promise<number>;
  /** id de categoría → id del padre (para que las subcategorías hereden la regla). */
  categoriasPadre(): Promise<Map<number, number | null>>;
}

export type MotivoCuponError =
  | "desactivado"
  | "no_disponible"
  | "invalido"
  | "no_existe"
  | "vencido"
  | "agotado"
  | "ya_usado"
  | "falta_rut"
  | "minimo"
  | "no_aplica"
  | "error";

export type ResultadoCupon =
  | {
      ok: true;
      cupon: CuponRegistro;
      reglas: ReglasCupon;
      descuento: number;
      base: number;
      excluidas: Array<{ productoId: number; motivo: string }>;
      /** Para reservar el uso al crear el pedido. */
      cliente: { emailHash: string; rutHash: string | null };
      maxTotal: number | null;
      maxPorCliente: number;
    }
  | { ok: false; motivo: MotivoCuponError; mensaje: string };

export const MENSAJES_CUPON = {
  desactivado: "Por ahora no tenemos cupones disponibles.",
  no_disponible: "No pudimos revisar el cupón en este momento. Puedes seguir sin cupón o intentar de nuevo en unos minutos.",
  invalido: "Ese código de cupón no es válido.",
  no_existe: "Ese cupón no existe o ya no está activo.",
  vencido: "Ese cupón ya venció o todavía no empieza.",
  agotado: "Ese cupón ya se agotó.",
  ya_usado: "Este cupón ya fue usado con tus datos (correo o RUT). Es uno por cliente.",
  falta_rut: "Para usar este cupón ingresa tu RUT.",
  error: "No pudimos aplicar el cupón. Puedes seguir sin cupón.",
} as const;

const CODIGO_RE = /^[A-Z0-9_-]{3,30}$/;

export interface EntradaEvaluarCupon {
  codigo: string;
  lineas: LineaCupon[];
  email: string;
  rut?: string | null;
  ahora?: number;
}

/** Revisa el cupón contra el carrito. No consume nada: sirve para la vista previa y como primer paso del pedido. */
export async function evaluarCuponCheckout(db: D1Like, repo: RepoCupones, e: EntradaEvaluarCupon): Promise<ResultadoCupon> {
  const ahora = e.ahora ?? Date.now();
  try {
    if (!(await leerInterruptorCupones(db))) return { ok: false, motivo: "desactivado", mensaje: MENSAJES_CUPON.desactivado };

    const codigo = String(e.codigo ?? "").trim().toUpperCase();
    if (!CODIGO_RE.test(codigo)) return { ok: false, motivo: "invalido", mensaje: MENSAJES_CUPON.invalido };

    const cupon = await repo.buscarPorCodigo(codigo);
    if (!cupon || !cupon.activo) return { ok: false, motivo: "no_existe", mensaje: MENSAJES_CUPON.no_existe };
    if (cupon.valido_desde && Date.parse(cupon.valido_desde) > ahora) return { ok: false, motivo: "vencido", mensaje: MENSAJES_CUPON.vencido };
    if (cupon.valido_hasta && Date.parse(cupon.valido_hasta) < ahora) return { ok: false, motivo: "vencido", mensaje: MENSAJES_CUPON.vencido };

    const reglas = await leerReglas(db, cupon.id);

    // Tope total: no se usa cuando la regla es "un uso por cliente".
    const maxTotal = reglas.unUsoPorCliente || !cupon.max_usos_total ? null : Math.max(0, Number(cupon.max_usos_total) - (Number(cupon.usos_actuales) || 0));
    // Por cliente: 1 con la regla nueva; si no, el límite antiguo (0 = sin límite).
    const maxPorCliente = reglas.unUsoPorCliente ? 1 : Math.max(0, Number(cupon.max_usos_por_usuario) || 0);

    const email = normalizarEmail(e.email);
    const rut = normalizarRut(e.rut ?? "");
    if (reglas.unUsoPorCliente && !rut) return { ok: false, motivo: "falta_rut", mensaje: MENSAJES_CUPON.falta_rut };
    if (!email || !email.includes("@")) return { ok: false, motivo: "invalido", mensaje: "Ingresa tu correo antes de aplicar el cupón." };
    const cliente = { emailHash: await huellaCliente("email", email), rutHash: rut ? await huellaCliente("rut", rut) : null };

    const usos = await contarUsos(db, cupon.id, ahora, cliente);
    if (maxTotal !== null && usos.total >= maxTotal) return { ok: false, motivo: "agotado", mensaje: MENSAJES_CUPON.agotado };
    if (maxPorCliente > 0) {
      const antiguos = await repo.usosAntiguosDeCorreo(cupon.id, email);
      if (usos.cliente + antiguos >= maxPorCliente) return { ok: false, motivo: "ya_usado", mensaje: MENSAJES_CUPON.ya_usado };
    }

    const padre = reglas.categoriasModo === "todas" ? new Map<number, number | null>() : await repo.categoriasPadre();
    const calculo: ResultadoCalculo = calcularCupon(
      { tipo: cupon.tipo, valor: Number(cupon.valor), montoMinimoCompra: Number(cupon.monto_minimo_compra) || 0 },
      reglas,
      e.lineas,
      padre,
    );
    if (!calculo.ok) {
      return { ok: false, motivo: calculo.codigo === "minimo" ? "minimo" : "no_aplica", mensaje: calculo.error };
    }
    return {
      ok: true, cupon, reglas, descuento: calculo.descuento, base: calculo.base, excluidas: calculo.excluidas,
      cliente, maxTotal, maxPorCliente,
    };
  } catch {
    // D1 caída, tablas sin migrar, Supabase fuera: fail-closed con mensaje claro.
    return { ok: false, motivo: "no_disponible", mensaje: MENSAJES_CUPON.no_disponible };
  }
}

/** Reserva el uso (atómico). Falla cerrado si la D1 no responde. */
export async function reservarCuponParaPedido(
  db: D1Like,
  ev: Extract<ResultadoCupon, { ok: true }>,
  metodoPago: string,
  ahora = Date.now(),
): Promise<{ ok: true; reservaId: string } | { ok: false; motivo: MotivoCuponError; mensaje: string }> {
  let r: ResultadoReserva;
  try {
    r = await reservarUsoCupon(db, {
      cuponId: ev.cupon.id,
      emailHash: ev.cliente.emailHash,
      rutHash: ev.cliente.rutHash,
      descuento: ev.descuento,
      montoCompra: ev.base,
      metodoPago,
      maxTotal: ev.maxTotal,
      maxPorCliente: ev.maxPorCliente,
      ahora,
    });
  } catch {
    return { ok: false, motivo: "no_disponible", mensaje: MENSAJES_CUPON.no_disponible };
  }
  if (r.ok) return { ok: true, reservaId: r.reservaId };
  return r.motivo === "ya_usado"
    ? { ok: false, motivo: "ya_usado", mensaje: MENSAJES_CUPON.ya_usado }
    : { ok: false, motivo: "agotado", mensaje: MENSAJES_CUPON.agotado };
}
