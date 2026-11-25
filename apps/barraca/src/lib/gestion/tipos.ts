/**
 * Tipos mínimos de D1 y errores de la base de gestión.
 *
 * Se declaran a mano (en vez de usar @cloudflare/workers-types) para no sumar
 * una dependencia y para que las pruebas puedan pasar una D1 simulada
 * (scripts/pruebas/d1-simulada.mjs). El binding real de Cloudflare cumple
 * estas interfaces tal cual.
 */

export interface D1ResultadoLike<T = unknown> {
  results: T[];
  success?: boolean;
  meta?: { changes?: number; last_row_id?: number };
}

export interface D1PreparadaLike {
  bind(...valores: unknown[]): D1PreparadaLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1ResultadoLike<T>>;
  run(): Promise<D1ResultadoLike>;
}

export interface D1Like {
  prepare(sql: string): D1PreparadaLike;
  /** Atómico: o se aplican todas las sentencias o ninguna. */
  batch(sentencias: D1PreparadaLike[]): Promise<unknown[]>;
}

/**
 * La base de gestión no está disponible: falta el binding GESTION_DB (p. ej.
 * `next dev` sin Cloudflare), la base no se creó o no tiene las tablas.
 * Los llamadores la atrapan y responden "gestión no disponible" sin romper
 * la tienda. El mensaje es genérico a propósito (no se muestra al cliente).
 */
export class GestionNoDisponibleError extends Error {
  readonly codigo = "GESTION_NO_DISPONIBLE";
  constructor(mensaje = "La base de gestión no está disponible.", opciones?: { cause?: unknown }) {
    super(mensaje, opciones);
    this.name = "GestionNoDisponibleError";
  }
}

export function esGestionNoDisponible(e: unknown): e is GestionNoDisponibleError {
  return e instanceof GestionNoDisponibleError;
}

/** Entrada inválida a una utilidad de gestión (programación, no datos del usuario). */
export class GestionEntradaError extends Error {
  readonly codigo = "GESTION_ENTRADA";
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "GestionEntradaError";
  }
}

export interface UsuarioGestion {
  id: string;
  email?: string | null;
}
