/**
 * Acceso a D1 del SEO editable, los relacionados y las guías (tablas de
 * migrations-gestion/0008). Recibe la D1 como parámetro (en producción viene de
 * `usarGestion`; en pruebas, de la D1 simulada). No toca la caché de Next ni
 * Supabase: eso lo hacen los servicios.
 */
import type { D1Like, UsuarioGestion } from "../gestion/index.ts";
import { desdeJson } from "../gestion/util.ts";
import { CAMPOS_VACIOS, claveTitulo, hayTexto, type CamposSeo, type TipoSeo } from "./reglas.ts";

const TANDA = 90;

interface FilaSeo {
  tipo: TipoSeo;
  clave: string;
  titulo: string | null;
  descripcion: string | null;
  og_titulo: string | null;
  og_descripcion: string | null;
  version: number;
  actualizado_por: string;
  actualizado_en: number;
}

export interface SeoGuardado extends CamposSeo {
  tipo: TipoSeo;
  clave: string;
  version: number;
  actualizadoPor: string;
  actualizadoEn: number;
}

const aGuardado = (f: FilaSeo): SeoGuardado => ({
  tipo: f.tipo, clave: f.clave, titulo: f.titulo, descripcion: f.descripcion, ogTitulo: f.og_titulo, ogDescripcion: f.og_descripcion,
  version: f.version, actualizadoPor: f.actualizado_por, actualizadoEn: f.actualizado_en,
});

export const camposDe = (s: CamposSeo | null | undefined): CamposSeo =>
  s ? { titulo: s.titulo, descripcion: s.descripcion, ogTitulo: s.ogTitulo, ogDescripcion: s.ogDescripcion } : { ...CAMPOS_VACIOS };

export const mismosCampos = (a: CamposSeo | null, b: CamposSeo | null): boolean => {
  const x = camposDe(a);
  const y = camposDe(b);
  return x.titulo === y.titulo && x.descripcion === y.descripcion && x.ogTitulo === y.ogTitulo && x.ogDescripcion === y.ogDescripcion;
};

const COLUMNAS = "tipo, clave, titulo, descripcion, og_titulo, og_descripcion, version, actualizado_por, actualizado_en";

export async function leerSeoGuardado(db: D1Like, tipo: TipoSeo, clave: string): Promise<SeoGuardado | null> {
  const f = await db.prepare(`SELECT ${COLUMNAS} FROM seo_meta WHERE tipo = ? AND clave = ?`).bind(tipo, clave).first<FilaSeo>();
  return f ? aGuardado(f) : null;
}

export async function leerSeoVarios(db: D1Like, tipo: TipoSeo, claves: string[]): Promise<Map<string, SeoGuardado>> {
  const mapa = new Map<string, SeoGuardado>();
  const unicas = [...new Set(claves)];
  for (let i = 0; i < unicas.length; i += TANDA) {
    const trozo = unicas.slice(i, i + TANDA);
    const r = await db.prepare(`SELECT ${COLUMNAS} FROM seo_meta WHERE tipo = ? AND clave IN (${trozo.map(() => "?").join(",")})`).bind(tipo, ...trozo).all<FilaSeo>();
    for (const f of r.results) mapa.set(f.clave, aGuardado(f));
  }
  return mapa;
}

export async function listarSeoGuardado(db: D1Like, tipo: TipoSeo | null, limite: number, desde: number): Promise<{ filas: SeoGuardado[]; total: number }> {
  const filtro = tipo ? "WHERE tipo = ?" : "";
  const args = tipo ? [tipo] : [];
  const total = await db.prepare(`SELECT COUNT(*) AS n FROM seo_meta ${filtro}`).bind(...args).first<{ n: number }>();
  const r = await db.prepare(`SELECT ${COLUMNAS} FROM seo_meta ${filtro} ORDER BY tipo, clave LIMIT ? OFFSET ?`).bind(...args, limite, desde).all<FilaSeo>();
  return { filas: r.results.map(aGuardado), total: total?.n ?? 0 };
}

export interface ResultadoEscrituraSeo {
  antes: CamposSeo | null;
  despues: CamposSeo | null;
  version: number;
}

/**
 * Guarda el texto propio de una entrada (o la deja sin texto propio con `campos = null`: vuelve a lo que genera el código)
 * y anota la versión. Atómico. Devuelve lo que había antes para poder deshacer.
 */
export async function escribirSeo(
  db: D1Like, usuario: UsuarioGestion, tipo: TipoSeo, clave: string, campos: CamposSeo | null, ahora: number, loteId: string | null,
): Promise<ResultadoEscrituraSeo> {
  const previo = await leerSeoGuardado(db, tipo, clave);
  const nuevos = campos && hayTexto(campos) ? campos : null;
  const c = camposDe(nuevos);
  const insVersion = db
    .prepare(
      `INSERT INTO seo_versiones (tipo, clave, version, titulo, descripcion, og_titulo, og_descripcion, creado_por, creado_email, creado_en, lote_id)
       SELECT ?1, ?2, COALESCE(MAX(version), 0) + 1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10 FROM seo_versiones WHERE tipo = ?1 AND clave = ?2`,
    )
    .bind(tipo, clave, c.titulo, c.descripcion, c.ogTitulo, c.ogDescripcion, usuario.id, usuario.email ?? null, ahora, loteId);
  const sentencias = [insVersion];
  if (nuevos) {
    sentencias.push(
      db
        .prepare(
          `INSERT INTO seo_meta (tipo, clave, titulo, descripcion, og_titulo, og_descripcion, titulo_clave, version, actualizado_por, actualizado_en)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, (SELECT MAX(version) FROM seo_versiones WHERE tipo = ?1 AND clave = ?2), ?8, ?9)
           ON CONFLICT (tipo, clave) DO UPDATE SET titulo = excluded.titulo, descripcion = excluded.descripcion, og_titulo = excluded.og_titulo,
             og_descripcion = excluded.og_descripcion, titulo_clave = excluded.titulo_clave, version = excluded.version,
             actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en`,
        )
        .bind(tipo, clave, c.titulo, c.descripcion, c.ogTitulo, c.ogDescripcion, c.titulo ? claveTitulo(c.titulo) : null, usuario.id, ahora),
    );
  } else {
    sentencias.push(db.prepare("DELETE FROM seo_meta WHERE tipo = ? AND clave = ?").bind(tipo, clave));
  }
  await db.batch(sentencias);
  const ahoraGuardado = await db.prepare("SELECT MAX(version) AS v FROM seo_versiones WHERE tipo = ? AND clave = ?").bind(tipo, clave).first<{ v: number }>();
  return { antes: previo ? camposDe(previo) : null, despues: nuevos, version: ahoraGuardado?.v ?? 1 };
}

export interface VersionSeo extends CamposSeo { version: number; creadoPor: string; creadoEn: number }

export async function versionesSeo(db: D1Like, tipo: TipoSeo, clave: string, limite = 10): Promise<VersionSeo[]> {
  const r = await db
    .prepare("SELECT version, titulo, descripcion, og_titulo, og_descripcion, creado_por, creado_en FROM seo_versiones WHERE tipo = ? AND clave = ? ORDER BY version DESC LIMIT ?")
    .bind(tipo, clave, limite)
    .all<{ version: number; titulo: string | null; descripcion: string | null; og_titulo: string | null; og_descripcion: string | null; creado_por: string; creado_en: number }>();
  return r.results.map((v) => ({ version: v.version, titulo: v.titulo, descripcion: v.descripcion, ogTitulo: v.og_titulo, ogDescripcion: v.og_descripcion, creadoPor: v.creado_por, creadoEn: v.creado_en }));
}

/** Otras entradas con el mismo título (comparado sin tildes ni mayúsculas). */
export async function entradasConTitulo(db: D1Like, titulo: string, excluir?: { tipo: TipoSeo; clave: string }, limite = 5): Promise<Array<{ tipo: TipoSeo; clave: string }>> {
  const r = await db
    .prepare("SELECT tipo, clave FROM seo_meta WHERE titulo_clave = ? AND NOT (tipo = ? AND clave = ?) ORDER BY tipo, clave LIMIT ?")
    .bind(claveTitulo(titulo), excluir?.tipo ?? "", excluir?.clave ?? "", limite)
    .all<{ tipo: TipoSeo; clave: string }>();
  return r.results;
}

/** Grupos de títulos repetidos entre las entradas con texto propio. */
export async function gruposTituloRepetido(db: D1Like, limite = 20): Promise<Array<{ titulo: string; entradas: Array<{ tipo: TipoSeo; clave: string }> }>> {
  const claves = await db
    .prepare("SELECT titulo_clave AS k, COUNT(*) AS n FROM seo_meta WHERE titulo_clave IS NOT NULL GROUP BY titulo_clave HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT ?")
    .bind(limite)
    .all<{ k: string; n: number }>();
  const grupos = [];
  for (const g of claves.results) {
    const filas = await db.prepare("SELECT tipo, clave, titulo FROM seo_meta WHERE titulo_clave = ? ORDER BY tipo, clave LIMIT 20").bind(g.k).all<{ tipo: TipoSeo; clave: string; titulo: string }>();
    grupos.push({ titulo: filas.results[0]?.titulo ?? g.k, entradas: filas.results.map((f) => ({ tipo: f.tipo, clave: f.clave })) });
  }
  return grupos;
}

// ── Relacionados ─────────────────────────────────────────────────────────────

export interface RelacionadosGuardados { codigo: string; lista: string[]; actualizadoPor: string; actualizadoEn: number }

function listaValida(texto: string | null): string[] | null {
  const v = desdeJson<unknown>(texto);
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string" && x.length > 0 && x.length <= 40)) return null;
  return v as string[];
}

export async function leerRelacionadosGuardados(db: D1Like, codigo: string): Promise<RelacionadosGuardados | null> {
  const f = await db.prepare("SELECT codigo, lista, actualizado_por, actualizado_en FROM productos_relacionados WHERE codigo = ?").bind(codigo).first<{ codigo: string; lista: string; actualizado_por: string; actualizado_en: number }>();
  if (!f) return null;
  const lista = listaValida(f.lista);
  return lista ? { codigo: f.codigo, lista, actualizadoPor: f.actualizado_por, actualizadoEn: f.actualizado_en } : null;
}

/** Fija la lista (o la quita con `null`: vuelve al criterio automático). Devuelve la lista anterior. */
export async function escribirRelacionados(db: D1Like, usuario: UsuarioGestion, codigo: string, lista: string[] | null, ahora: number): Promise<string[] | null> {
  const previo = await leerRelacionadosGuardados(db, codigo);
  if (lista && lista.length > 0) {
    await db
      .prepare(
        `INSERT INTO productos_relacionados (codigo, lista, actualizado_por, actualizado_en) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (codigo) DO UPDATE SET lista = excluded.lista, actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en`,
      )
      .bind(codigo, JSON.stringify(lista), usuario.id, ahora)
      .run();
  } else {
    await db.prepare("DELETE FROM productos_relacionados WHERE codigo = ?").bind(codigo).run();
  }
  return previo?.lista ?? null;
}

// ── Guías ────────────────────────────────────────────────────────────────────

export interface FilaGuia {
  slug: string;
  borrador: string | null;
  borradorPor: string | null;
  borradorEn: number | null;
  publicado: string | null;
  versionPublicada: number | null;
  publicadoPor: string | null;
  publicadoEn: number | null;
}

interface FilaGuiaCruda {
  slug: string; borrador: string | null; borrador_por: string | null; borrador_en: number | null;
  publicado: string | null; version_publicada: number | null; publicado_por: string | null; publicado_en: number | null;
}

const aFilaGuia = (f: FilaGuiaCruda): FilaGuia => ({
  slug: f.slug, borrador: f.borrador, borradorPor: f.borrador_por, borradorEn: f.borrador_en,
  publicado: f.publicado, versionPublicada: f.version_publicada, publicadoPor: f.publicado_por, publicadoEn: f.publicado_en,
});

export async function leerFilaGuia(db: D1Like, slug: string): Promise<FilaGuia | null> {
  const f = await db.prepare("SELECT * FROM guias WHERE slug = ?").bind(slug).first<FilaGuiaCruda>();
  return f ? aFilaGuia(f) : null;
}

export async function listarFilasGuias(db: D1Like): Promise<FilaGuia[]> {
  const r = await db.prepare("SELECT * FROM guias ORDER BY slug LIMIT 200").all<FilaGuiaCruda>();
  return r.results.map(aFilaGuia);
}

/** Todo lo publicado, en una consulta (lo usa la tienda). */
export async function leerGuiasPublicadasCrudas(db: D1Like): Promise<Array<{ slug: string; json: string; version: number | null }>> {
  const r = await db.prepare("SELECT slug, publicado, version_publicada FROM guias WHERE publicado IS NOT NULL LIMIT 200").all<{ slug: string; publicado: string; version_publicada: number | null }>();
  return r.results.map((f) => ({ slug: f.slug, json: f.publicado, version: f.version_publicada }));
}

export async function escribirBorradorGuia(db: D1Like, usuario: UsuarioGestion, slug: string, json: string | null, ahora: number): Promise<string | null> {
  const previa = await leerFilaGuia(db, slug);
  await db
    .prepare(
      `INSERT INTO guias (slug, borrador, borrador_por, borrador_en) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (slug) DO UPDATE SET borrador = excluded.borrador, borrador_por = excluded.borrador_por, borrador_en = excluded.borrador_en`,
    )
    .bind(slug, json, json === null ? null : usuario.id, json === null ? null : ahora)
    .run();
  return previa?.borrador ?? null;
}

/** Publica `json` como nueva versión (la anterior pasa a «reemplazada»). Devuelve la versión nueva y lo que estaba publicado. */
export async function publicarGuiaD1(
  db: D1Like, usuario: UsuarioGestion, slug: string, json: string, ahora: number, extra: { nota?: string | null; restauradaDe?: number | null; limpiarBorrador?: boolean } = {},
): Promise<{ version: number; anterior: { json: string; version: number | null } | null }> {
  const previa = await leerFilaGuia(db, slug);
  const maxV = await db.prepare("SELECT COALESCE(MAX(version), 0) AS v FROM guias_versiones WHERE slug = ?").bind(slug).first<{ v: number }>();
  const version = (maxV?.v ?? 0) + 1;
  await db.batch([
    db.prepare("UPDATE guias_versiones SET estado = 'reemplazada' WHERE slug = ? AND estado = 'publicada'").bind(slug),
    db
      .prepare("INSERT INTO guias_versiones (slug, version, valor, estado, nota, creado_por, creado_en, restaurada_de) VALUES (?, ?, ?, 'publicada', ?, ?, ?, ?)")
      .bind(slug, version, json, extra.nota ?? null, usuario.id, ahora, extra.restauradaDe ?? null),
    db
      .prepare(
        `INSERT INTO guias (slug, publicado, version_publicada, publicado_por, publicado_en) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (slug) DO UPDATE SET publicado = excluded.publicado, version_publicada = excluded.version_publicada,
           publicado_por = excluded.publicado_por, publicado_en = excluded.publicado_en,
           borrador = CASE WHEN ?6 = 1 THEN NULL ELSE guias.borrador END,
           borrador_por = CASE WHEN ?6 = 1 THEN NULL ELSE guias.borrador_por END,
           borrador_en = CASE WHEN ?6 = 1 THEN NULL ELSE guias.borrador_en END`,
      )
      .bind(slug, json, version, usuario.id, ahora, extra.limpiarBorrador ? 1 : 0),
  ]);
  return { version, anterior: previa?.publicado ? { json: previa.publicado, version: previa.versionPublicada } : null };
}

/** Quita lo publicado (la tienda vuelve a la guía de código, o la guía nueva deja de existir). */
export async function despublicarGuiaD1(db: D1Like, slug: string): Promise<void> {
  await db.batch([
    db.prepare("UPDATE guias_versiones SET estado = 'reemplazada' WHERE slug = ? AND estado = 'publicada'").bind(slug),
    db.prepare("UPDATE guias SET publicado = NULL, version_publicada = NULL, publicado_por = NULL, publicado_en = NULL WHERE slug = ?").bind(slug),
  ]);
}

export interface VersionGuia { version: number; estado: string; nota: string | null; creadoPor: string; creadoEn: number; restauradaDe: number | null }

export async function versionesGuia(db: D1Like, slug: string, limite = 10): Promise<VersionGuia[]> {
  const r = await db
    .prepare("SELECT version, estado, nota, creado_por, creado_en, restaurada_de FROM guias_versiones WHERE slug = ? ORDER BY version DESC LIMIT ?")
    .bind(slug, limite)
    .all<{ version: number; estado: string; nota: string | null; creado_por: string; creado_en: number; restaurada_de: number | null }>();
  return r.results.map((v) => ({ version: v.version, estado: v.estado, nota: v.nota, creadoPor: v.creado_por, creadoEn: v.creado_en, restauradaDe: v.restaurada_de }));
}

export async function valorVersionGuia(db: D1Like, slug: string, version: number): Promise<string | null> {
  const f = await db.prepare("SELECT valor FROM guias_versiones WHERE slug = ? AND version = ?").bind(slug, version).first<{ valor: string }>();
  return f?.valor ?? null;
}
