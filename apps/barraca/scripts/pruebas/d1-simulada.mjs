// D1 simulada para pruebas: SQLite en memoria (node:sqlite, incluido en Node 22+,
// cero dependencias) con la misma forma que el binding de Cloudflare
// (prepare/bind/first/all/run/batch/exec) y que aplica las migraciones REALES
// de migrations-gestion/. Cómo reutilizarla: docs/MCP-NOTAS.md ("Arnés de pruebas D1").
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DIR_MIGRACIONES_GESTION = path.join(RAIZ, "migrations-gestion");

/** Archivos NNNN_nombre.sql de una carpeta, en orden de número. */
export function listarMigraciones(dir = DIR_MIGRACIONES_GESTION) {
  return readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
}

function aParametro(v) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

class Preparada {
  constructor(sqlite, sql, params = []) {
    this.sqlite = sqlite;
    this.sql = sql;
    this.params = params;
  }
  bind(...valores) {
    return new Preparada(this.sqlite, this.sql, valores.map(aParametro));
  }
  _stmt() {
    return this.sqlite.prepare(this.sql);
  }
  async first() {
    return this._stmt().get(...this.params) ?? null;
  }
  async all() {
    const results = this._stmt().all(...this.params);
    return { results, success: true, meta: { changes: 0 } };
  }
  async run() {
    const r = this._stmt().run(...this.params);
    return { results: [], success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
  _correrEnBatch() {
    // all() sirve tanto para SELECT como para sentencias sin filas.
    const stmt = this._stmt();
    if (stmt.columns().length > 0) return { results: stmt.all(...this.params), success: true };
    const r = stmt.run(...this.params);
    return { results: [], success: true, meta: { changes: Number(r.changes) } };
  }
}

/**
 * @param {{ migraciones?: boolean | string, dir?: string }} [opciones]
 *   migraciones: true (por defecto) aplica todas las de migrations-gestion/;
 *   false no aplica ninguna; un nombre de archivo aplica hasta ese (inclusive).
 */
export function crearD1Simulada(opciones = {}) {
  const { migraciones = true, dir = DIR_MIGRACIONES_GESTION } = opciones;
  const sqlite = new DatabaseSync(":memory:");
  const db = {
    sqlite,
    prepare: (sql) => new Preparada(sqlite, sql),
    exec: async (sql) => { sqlite.exec(sql); },
    // Atómico, como D1: si una sentencia falla se revierte todo el batch.
    async batch(sentencias) {
      sqlite.exec("BEGIN");
      try {
        const salida = sentencias.map((s) => s._correrEnBatch());
        sqlite.exec("COMMIT");
        return salida;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
    close: () => sqlite.close(),
  };
  if (migraciones) {
    for (const f of listarMigraciones(dir)) {
      sqlite.exec(readFileSync(path.join(dir, f), "utf8"));
      if (migraciones === f) break;
    }
  }
  return db;
}
