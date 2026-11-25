/**
 * Borrado de DATOS PERSONALES de una persona (cliente o suscriptor), de A UNO. Lógica pura con puertos: la conexión real
 * a Supabase vive en `personas-supabase.ts` y las pruebas usan un doble en memoria.
 *
 * Dónde hay datos personales (investigado en el código y las migraciones) y qué se hace:
 *  - barraca_suscriptores (correo, nombre) .............. se BORRA la fila.
 *  - barraca_carrito_abandonado (correo, carrito) ........ se BORRA.
 *  - barraca_pedidos NUNCA pagados y cerrados (cancelado, pago_rechazado, rechazado) ... se ANONIMIZAN (nombre, RUT, teléfono,
 *    correo, dirección, notas, datos de factura, nota y archivo del comprobante). Sus notas internas (D1) se borran.
 *  - barraca_pedidos PAGADOS ............................. se CONSERVAN completos: son respaldo tributario (el SII exige
 *    guardar los documentos por 6 años) y el panel no tiene una anonimización parcial aprobada. Ante la duda, se conserva y se avisa.
 *  - Pedidos ABIERTOS (pendiente de pago, transferencia informada): se NIEGA la operación (hay una compra en curso).
 *  - barraca_cotizaciones: las NO pagadas se anonimizan; las pagadas se conservan (respaldo).
 *  - barraca_reviews (opiniones atadas a sus pedidos): se anonimiza el autor; el texto de la opinión se conserva.
 *  - barraca_usuarios (cuentas antiguas, la tienda ya no usa cuentas): se anonimiza la fila (no se borra: la referencian
 *    cotizaciones y opiniones antiguas).
 *  - Se CONSERVAN a propósito: huellas de bajas de correo y de envíos de campañas (HMAC, no son un correo) y huellas de
 *    uso de cupones (SHA-256): borrarlas volvería a suscribir a quien pidió la baja o permitiría reusar un cupón.
 *
 * La persona se identifica por el correo que escribe quien opera (no se lista ni se devuelve ningún correo): la vista previa
 * da una referencia corta y la confirmación exige el MISMO correo (la huella incluye la referencia). Auditoría solo con esa
 * referencia.
 *
 * La referencia es un HMAC-SHA256 con un secreto del worker (`BORRADO_REF_PEPPER`, ver `pimienta.ts`), no un hash simple:
 * un SHA-256 sin sal de un correo se adivina por diccionario y, como la referencia queda en la auditoría y en el aviso, serviría
 * para saber si un correo conocido fue borrado. Sin el secreto, la herramienta de borrar personas se bloquea.
 *
 * Sin oráculo de existencia: la VISTA PREVIA responde igual exista o no la persona (solo dice qué se haría «si existe»); si
 * existe, si tiene compras abiertas o si no hay nada que borrar se sabe recién en la CONFIRMACIÓN (que exige id de un solo uso,
 * espera mínima, el mismo correo y gasta un cupo de los topes de volumen). Ver borrado.ts.
 */
/** Largo mínimo (caracteres) del secreto `BORRADO_REF_PEPPER`. */
export const PIMIENTA_MIN = 32;

export type AlcancePersona = "suscriptor" | "cliente_completo";

/** Cada método devuelve `null` si la tabla no existe en esa base (se informa como «no existe»). */
export interface PuertoPersonas {
  contarSuscriptores(email: string): Promise<number | null>;
  borrarSuscriptores(email: string): Promise<number>;
  contarCarritos(email: string): Promise<number | null>;
  borrarCarritos(email: string): Promise<number>;
  /** `abiertas` = cotizaciones aprobadas o aceptadas que no se pagaron todavía (pago en curso). */
  cotizaciones(email: string): Promise<{ total: number; pagadas: number; abiertas?: number } | null>;
  anonimizarCotizacionesNoPagadas(email: string): Promise<number>;
  pedidos(email: string): Promise<Array<{ numero: string; estado: string; pagado: boolean; comprobante_path: string | null }>>;
  anonimizarPedidos(numeros: string[]): Promise<number>;
  contarOpiniones(numerosPedido: string[]): Promise<number | null>;
  anonimizarOpiniones(numerosPedido: string[]): Promise<number>;
  usuariosAntiguos(email: string): Promise<number | null>;
  anonimizarUsuariosAntiguos(email: string): Promise<number>;
  borrarComprobante(ruta: string): Promise<void>;
  /** Notas internas (D1) de esos pedidos. */
  borrarNotasInternas(numeros: string[]): Promise<number>;
  contarNotasInternas(numeros: string[]): Promise<number>;
}

export const ESTADOS_ABIERTOS = ["pendiente_pago", "transferencia_informada"];
/** Cotización con el cobro en marcha (aprobada con enlace de pago, o contraoferta aceptada): no se anonimiza ni se le quita el enlace de pago. */
export const ESTADOS_COTIZACION_ABIERTA = ["aprobada", "aceptada"];
export const ESTADOS_CERRADOS_SIN_PAGO = ["cancelado", "pago_rechazado", "rechazado"];

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/** HMAC-SHA256 en hexadecimal (WebCrypto, sin dependencias). */
export async function hmacSha256Hex(secreto: string, texto: string): Promise<string> {
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(firma), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Referencia corta y estable de la persona (para auditoría y mensajes): HMAC con el secreto del worker, NO es el correo. */
export async function referenciaPersona(correo: string, pimienta: string): Promise<string> {
  if (typeof pimienta !== "string" || pimienta.length < PIMIENTA_MIN) throw new Error("falta_pimienta");
  return (await hmacSha256Hex(pimienta, `persona:${normalizarCorreo(correo)}`)).slice(0, 12);
}

export interface PlanPersona {
  alcance: AlcancePersona;
  ref: string;
  /** Conteos por tabla (null = la tabla no existe). */
  suscriptores: number | null;
  carritos: number | null;
  cotizacionesAnonimizar: number | null;
  cotizacionesConservar: number | null;
  pedidosAnonimizar: string[];
  pedidosConservarPagados: number;
  pedidosAbiertos: string[];
  /** Cotizaciones aprobadas o aceptadas sin pagar (pago en curso). */
  cotizacionesAbiertas: number;
  /** Motivo por el que NO se debe operar (compra o cobro en curso); null = se puede. */
  negado: string | null;
  comprobantes: number;
  opiniones: number | null;
  cuentasAntiguas: number | null;
  notasInternas: number;
  /** Nada que borrar ni anonimizar. */
  vacio: boolean;
}

export async function planificarPersona(puerto: PuertoPersonas, correo: string, alcance: AlcancePersona, pimienta: string): Promise<PlanPersona> {
  const email = normalizarCorreo(correo);
  const ref = await referenciaPersona(email, pimienta);
  const suscriptores = await puerto.contarSuscriptores(email);
  const base: PlanPersona = {
    alcance, ref, suscriptores, carritos: 0, cotizacionesAnonimizar: 0, cotizacionesConservar: 0, pedidosAnonimizar: [],
    pedidosConservarPagados: 0, pedidosAbiertos: [], cotizacionesAbiertas: 0, negado: null, comprobantes: 0, opiniones: 0, cuentasAntiguas: 0, notasInternas: 0, vacio: false,
  };
  if (alcance === "suscriptor") return { ...base, vacio: !suscriptores };
  const carritos = await puerto.contarCarritos(email);
  const cot = await puerto.cotizaciones(email);
  const peds = await puerto.pedidos(email);
  const pagados = peds.filter((p) => p.pagado);
  const sinPago = peds.filter((p) => !p.pagado);
  const abiertos = sinPago.filter((p) => ESTADOS_ABIERTOS.includes(p.estado)).map((p) => p.numero);
  const anonimizar = sinPago.filter((p) => ESTADOS_CERRADOS_SIN_PAGO.includes(p.estado));
  const numerosTodos = peds.map((p) => p.numero);
  const opiniones = numerosTodos.length ? await puerto.contarOpiniones(numerosTodos) : 0;
  const cuentasAntiguas = await puerto.usuariosAntiguos(email);
  const notasInternas = anonimizar.length ? await puerto.contarNotasInternas(anonimizar.map((p) => p.numero)) : 0;
  const plan: PlanPersona = {
    ...base, carritos, cotizacionesAnonimizar: cot ? cot.total - cot.pagadas : null, cotizacionesConservar: cot ? cot.pagadas : null,
    pedidosAnonimizar: anonimizar.map((p) => p.numero), pedidosConservarPagados: pagados.length, pedidosAbiertos: abiertos,
    cotizacionesAbiertas: cot?.abiertas ?? 0,
    comprobantes: anonimizar.filter((p) => !!p.comprobante_path).length, opiniones, cuentasAntiguas, notasInternas,
  };
  const partes: string[] = [];
  if (abiertos.length) partes.push(`${abiertos.length} pedido(s) abierto(s) (${abiertos.join(", ")}): una compra en curso`);
  if (plan.cotizacionesAbiertas > 0) partes.push(`${plan.cotizacionesAbiertas} cotización(es) abierta(s) (aprobada o aceptada) con el cobro en curso`);
  plan.negado = partes.length ? `Esa persona tiene ${partes.join(" y ")}. Cancélalos o espera a que cierren y vuelve a intentar. No se hizo nada.` : null;
  plan.vacio = !(suscriptores || carritos || plan.cotizacionesAnonimizar || plan.pedidosAnonimizar.length || opiniones || cuentasAntiguas);
  return plan;
}

/** Lo que cuenta para la huella: si algo de esto cambia entre la vista previa y la confirmación, se rechaza. */
export function datosParaHuella(plan: PlanPersona) {
  return { ...plan, pedidosAnonimizar: [...plan.pedidosAnonimizar].sort(), pedidosAbiertos: [...plan.pedidosAbiertos].sort() };
}

export interface ResultadoBorradoPersona {
  suscriptoresBorrados: number;
  carritosBorrados: number;
  cotizacionesAnonimizadas: number;
  pedidosAnonimizados: number;
  opinionesAnonimizadas: number;
  cuentasAnonimizadas: number;
  comprobantesBorrados: number;
  notasBorradas: number;
}

/**
 * Aplica el plan. Cada paso es idempotente (volver a correrlo no rompe nada). Si un paso falla, se lanza con lo ya
 * hecho en `parcial` para que quien opera sepa dónde quedó.
 */
export async function aplicarBorradoPersona(puerto: PuertoPersonas, correo: string, plan: PlanPersona): Promise<ResultadoBorradoPersona> {
  const email = normalizarCorreo(correo);
  const r: ResultadoBorradoPersona = { suscriptoresBorrados: 0, carritosBorrados: 0, cotizacionesAnonimizadas: 0, pedidosAnonimizados: 0, opinionesAnonimizadas: 0, cuentasAnonimizadas: 0, comprobantesBorrados: 0, notasBorradas: 0 };
  try {
    if (plan.alcance === "suscriptor") {
      r.suscriptoresBorrados = await puerto.borrarSuscriptores(email);
      return r;
    }
    // Las opiniones se enlazan por los pedidos: se anonimizan primero, antes de tocar los pedidos.
    const todos = await puerto.pedidos(email);
    if (todos.length) r.opinionesAnonimizadas = await puerto.anonimizarOpiniones(todos.map((p) => p.numero));
    r.carritosBorrados = await puerto.borrarCarritos(email);
    r.suscriptoresBorrados = await puerto.borrarSuscriptores(email);
    r.cotizacionesAnonimizadas = await puerto.anonimizarCotizacionesNoPagadas(email);
    r.cuentasAnonimizadas = await puerto.anonimizarUsuariosAntiguos(email);
    const aAnonimizar = todos.filter((p) => !p.pagado && ESTADOS_CERRADOS_SIN_PAGO.includes(p.estado));
    for (const p of aAnonimizar) {
      if (p.comprobante_path) { await puerto.borrarComprobante(p.comprobante_path); r.comprobantesBorrados++; }
    }
    if (aAnonimizar.length) {
      const numeros = aAnonimizar.map((p) => p.numero);
      r.pedidosAnonimizados = await puerto.anonimizarPedidos(numeros);
      r.notasBorradas = await puerto.borrarNotasInternas(numeros);
    }
    return r;
  } catch (e) {
    throw Object.assign(new Error("borrado_parcial"), { parcial: r, causa: e });
  }
}
