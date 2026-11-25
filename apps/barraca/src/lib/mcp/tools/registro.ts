/**
 * Registro de herramientas del MCP. Cada herramienta nueva es UN archivo en
 * src/lib/mcp/tools/ que exporta `defineHerramienta({...})`, más una línea en
 * tools/index.ts. El núcleo (servidor, OAuth) no se toca.
 *
 * Reglas que el servidor aplica a TODAS las herramientas:
 * - La entrada se valida con el esquema zod en modo estricto (campos extra = error).
 * - Las anotaciones readOnlyHint / destructiveHint / idempotentHint son obligatorias.
 * - Una herramienta que escribe exige el permiso `tienda:escribir`.
 * - El usuario se revalida (admin con scope barraca) antes de ejecutar.
 * - Los errores que no sean `ErrorHerramienta` salen como mensaje genérico.
 */
import { z } from "@jurmaq/shared/validation";
import type { CambioAuditado, D1Like, EntradaAuditoria, UsuarioGestion } from "../../gestion/index.ts";

export { z };

/** Lo que recibe cada herramienta al ejecutarse. */
export interface ContextoHerramienta {
  usuario: UsuarioGestion;
  clienteId: string;
  /** Lote de auditoría de ESTA llamada: todos sus cambios se deshacen juntos. */
  loteId: string;
  /** Base de gestión (GESTION_DB). */
  db: D1Like;
  ahora: number;
  /** Registra cambios en la auditoría bajo el lote de esta llamada. Úsalo después de escribir en Supabase. */
  auditar(cambios: Array<Omit<CambioAuditado, "herramienta"> & { herramienta?: string }>): Promise<void>;
  /** Catálogo de herramientas disponibles (para la herramienta `guia`). */
  catalogo: ReadonlyArray<{ nombre: string; titulo: string; descripcion: string; soloLectura: boolean }>;
}

export type SalidaHerramienta = string | { texto: string; datos?: Record<string, unknown> };

export interface AnotacionesHerramienta {
  /** No cambia nada. */
  readOnlyHint: boolean;
  /** Puede borrar o dejar un dato peor que antes (aunque se pueda deshacer). */
  destructiveHint: boolean;
  /** Repetir la llamada con los mismos datos no cambia nada más. */
  idempotentHint: boolean;
}

export interface ContextoRevertidor {
  db: D1Like;
  usuario: UsuarioGestion;
  ahora: number;
  /** Entradas vigentes (no deshechas) del lote que pertenecen a esta herramienta. */
  entradas: EntradaAuditoria[];
  /** Si es true, el revertidor NO escribe nada: solo comprueba que se podría deshacer y devuelve el motivo si no. */
  simular?: boolean;
}

export type ResultadoRevertidor = { ok: true; mensaje?: string } | { ok: false; mensaje: string };

/**
 * Deshace los cambios de un lote. Debe: (1) reescribir los valores `antes` en
 * Supabase, (2) NO pisar un cambio posterior hecho por otra persona (compara
 * con `despues`; si ya no coincide, devuelve ok:false o salta esa entrada y
 * dilo en el mensaje), (3) ser repetible sin daño. El mecanismo marca el lote
 * como deshecho solo si TODOS los revertidores devuelven ok:true.
 */
export type Revertidor = (ctx: ContextoRevertidor) => Promise<ResultadoRevertidor>;

export interface Herramienta<E extends z.ZodObject = z.ZodObject> {
  /** snake_case, ASCII, hasta 64 caracteres. */
  nombre: string;
  /** Título corto en español. */
  titulo: string;
  /** Qué hace y cuándo usarla, en español claro (lo lee Claude). */
  descripcion: string;
  /** Entrada: objeto zod. El servidor lo vuelve estricto. */
  esquema: E;
  anotaciones: AnotacionesHerramienta;
  ejecutar(args: z.infer<E>, ctx: ContextoHerramienta): Promise<SalidaHerramienta>;
  /** Cómo deshacer lo que esta herramienta audita (si no hay, sus lotes no tienen botón Deshacer). */
  revertidor?: Revertidor;
  /** Comprobación SIN escribir de que el deshacer hoy funcionaría (recibe `simular: true`). Si no hay, se asume que sí. */
  puedeDeshacer?: Revertidor;
}

/** Error con mensaje seguro de mostrar a Claude y a la persona. Cualquier otro error sale genérico. */
export class ErrorHerramienta extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorHerramienta";
  }
}

const NOMBRE_VALIDO = /^[a-z][a-z0-9_]{1,63}$/;

export function defineHerramienta<E extends z.ZodObject>(h: Herramienta<E>): Herramienta<E> {
  if (!NOMBRE_VALIDO.test(h.nombre)) throw new Error(`Nombre de herramienta inválido: ${h.nombre}`);
  if (!h.titulo.trim() || !h.descripcion.trim()) throw new Error(`Falta título o descripción en ${h.nombre}`);
  const a = h.anotaciones;
  if (typeof a?.readOnlyHint !== "boolean" || typeof a.destructiveHint !== "boolean" || typeof a.idempotentHint !== "boolean") {
    throw new Error(`Faltan anotaciones en ${h.nombre}`);
  }
  if (a.readOnlyHint && (a.destructiveHint || h.revertidor)) throw new Error(`${h.nombre}: una herramienta de solo lectura no destruye ni se revierte`);
  return h;
}

export interface Registro {
  agregar(...hs: Herramienta[]): void;
  lista(): Herramienta[];
  obtener(nombre: string): Herramienta | undefined;
  /** ¿Todas las herramientas de estos nombres tienen revertidor? */
  puedenDeshacerse(nombres: string[]): boolean;
}

export function crearRegistro(): Registro {
  const mapa = new Map<string, Herramienta>();
  return {
    agregar(...hs) {
      for (const h of hs) {
        if (mapa.has(h.nombre)) throw new Error(`Herramienta repetida: ${h.nombre}`);
        mapa.set(h.nombre, h);
      }
    },
    lista: () => [...mapa.values()],
    obtener: (n) => mapa.get(n),
    puedenDeshacerse: (nombres) => nombres.length > 0 && nombres.every((n) => !!mapa.get(n)?.revertidor),
  };
}
