/**
 * Porcentaje de descuento por transferencia leído de la base de gestión
 * (tabla `ajustes`, clave `descuento_transferencia_pct`).
 *
 * Regla de oro: sin fila, con la base caída o lenta, sin migrar o con un valor
 * dañado o fuera de rango, se usa el respaldo en código (2%) y todo calcula
 * igual que antes. Nunca lanza.
 *
 * Quien crea un pedido lo lee UNA vez (al empezar) y usa ese mismo valor para
 * el cupón (piso cobrable) y para el total, así el pedido es consistente aunque
 * Jorge lo cambie justo en ese momento. El checkout manda el valor que mostró
 * (`pctTransferenciaVisto`) y el servidor rechaza si cambió.
 */
import type { D1Like } from "../gestion/tipos.ts";
import { DESCUENTO_TRANSFERENCIA_PCT, leerPctGuardado } from "./descuento-transferencia.ts";

export const CLAVE_DESCUENTO_TRANSFERENCIA = "descuento_transferencia_pct";

export interface LecturaDescuento {
  pct: number;
  /** "d1" = viene de la base; "codigo" = respaldo (sin fila, base caída o valor dañado). */
  origen: "d1" | "codigo";
}

const RESPALDO: LecturaDescuento = { pct: DESCUENTO_TRANSFERENCIA_PCT, origen: "codigo" };

/** Lee el valor desde una D1 concreta. Nunca lanza: ante cualquier problema devuelve el respaldo. */
export async function leerDescuentoTransferencia(db: D1Like): Promise<LecturaDescuento> {
  try {
    const f = await db.prepare("SELECT valor FROM ajustes WHERE clave = ?").bind(CLAVE_DESCUENTO_TRANSFERENCIA).first<{ valor: string }>();
    const pct = leerPctGuardado(f?.valor);
    return pct === null ? RESPALDO : { pct, origen: "d1" };
  } catch {
    return RESPALDO;
  }
}

const TIEMPO_MAX_MS = 1200;
const PAUSA_TRAS_FALLO_MS = 15_000;
let sinIntentarHasta = 0;
/**
 * Último valor leído con éxito de la base, por isolate. Si la base cae después, se sigue usando este
 * (así un 0 % o un 3 % que Jorge dejó no salta al 2 % del código). En un isolate frío (sin lectura
 * previa) y con la base caída vale el 2 % del código: es el único valor que se conoce.
 */
let ultimoBueno: number | null = null;

function conPlazo<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((ok, mal) => {
    const t = setTimeout(() => mal(new Error("plazo")), ms);
    p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); mal(e); });
  });
}

export interface DepsPctActual {
  obtenerDb?: () => Promise<D1Like | null>;
  ahora?: () => number;
}

/**
 * El porcentaje vigente para la tienda (servidor). Sin binding, en el build o en
 * `next dev` devuelve el respaldo sin tocar nada. Tras un fallo no reintenta por
 * 15 s para no sumar latencia con la base caída, y mientras tanto (y en cada fallo)
 * usa el último valor bueno de este isolate; si no hay ninguno, el 2 % del código.
 */
export async function pctTransferenciaActual(deps: DepsPctActual = {}): Promise<number> {
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "development") return DESCUENTO_TRANSFERENCIA_PCT;
  const ahora = deps.ahora ?? Date.now;
  if (ahora() < sinIntentarHasta) return ultimoBueno ?? DESCUENTO_TRANSFERENCIA_PCT;
  try {
    const db = deps.obtenerDb ? await deps.obtenerDb() : await (await import("../gestion/d1.ts")).obtenerGestionDb();
    if (!db) return DESCUENTO_TRANSFERENCIA_PCT;
    const f = await conPlazo(db.prepare("SELECT valor FROM ajustes WHERE clave = ?").bind(CLAVE_DESCUENTO_TRANSFERENCIA).first<{ valor: string }>(), TIEMPO_MAX_MS);
    const pct = leerPctGuardado(f?.valor) ?? DESCUENTO_TRANSFERENCIA_PCT;
    ultimoBueno = pct;
    return pct;
  } catch {
    sinIntentarHasta = ahora() + PAUSA_TRAS_FALLO_MS;
    return ultimoBueno ?? DESCUENTO_TRANSFERENCIA_PCT;
  }
}

/** Solo para pruebas. */
export function reiniciarPausaDescuento(): void {
  sinIntentarHasta = 0;
  ultimoBueno = null;
}
