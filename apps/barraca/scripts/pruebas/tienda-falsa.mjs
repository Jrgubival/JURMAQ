// Tienda falsa en memoria para probar la gestión de productos, precios, ofertas y despacho.
// Implementa la misma interfaz que repo-supabase.ts (RepoProductos, RepoCategorias, RepoZonas)
// y el servicio de aprobaciones real sobre una D1 simulada, con el correo capturado.
// NUNCA toca Supabase ni envía correos.
import { registrarLote } from "../../src/lib/gestion/index.ts";
import { solicitarAprobacion } from "../../src/lib/mcp/aprobaciones.ts";

export const ficha = (o) => ({
  id: 1, codigo: "X", nombre: "Producto", slug: `p-${o.id ?? 1}`, descripcion: null, precio: 1000, precio_original: null, en_oferta: false,
  oferta_fin: null, combo_cantidad: null, combo_precio: null, costo: null, stock: 10, activo: true, categoria_id: null,
  imagen: "/images/barraca/x.jpg", solo_cotizar: false, ...o,
});

const copia = (x) => JSON.parse(JSON.stringify(x));

export function crearTienda(fichas = [], opciones = {}) {
  const filas = fichas.map(ficha);
  const categorias = (opciones.categorias ?? []).map((c) => ({ descripcion: null, orden: 0, padre_id: null, activa: true, slug: `c-${c.id}`, ...c }));
  const zonas = (opciones.zonas ?? []).map((z) => ({ gratis_desde: null, activo: true, orden: 0, comuna: "ZMO", ...z }));
  const contadores = { escrituras: 0, revalidados: [], zonasInvalidadas: 0, consultas: 0 };
  let nextId = filas.reduce((m, f) => Math.max(m, f.id), 0) + 1;

  const productos = {
    async fichasPorCodigos(codigos) { contadores.consultas++; const s = new Set(codigos.map((c) => c.trim())); return copia(filas.filter((f) => f.codigo && s.has(f.codigo))); },
    async fichasPorIds(ids) { const s = new Set(ids); return copia(filas.filter((f) => s.has(f.id))); },
    async fichasPorCategorias(ids, { soloActivas, tope }) { return copia(filas.filter((f) => ids.includes(f.categoria_id) && (!soloActivas || f.activo)).slice(0, tope)); },
    async fichasActivas({ categoriaIds, tope }) { return copia(filas.filter((f) => f.activo && (!categoriaIds || categoriaIds.includes(f.categoria_id))).slice(0, tope)); },
    async buscar(f) {
      let r = filas.filter((x) => (f.estado === "todos" ? true : f.estado === "activo" ? x.activo : !x.activo));
      if (f.codigo) r = r.filter((x) => x.codigo === f.codigo);
      if (f.texto) r = r.filter((x) => `${x.nombre} ${x.codigo}`.toLowerCase().includes(f.texto.toLowerCase()));
      if (f.categoriaIds) r = r.filter((x) => f.categoriaIds.includes(x.categoria_id));
      if (f.sinFoto) r = r.filter((x) => !x.imagen);
      if (f.sinStock) r = r.filter((x) => !x.stock);
      if (f.soloOferta) r = r.filter((x) => x.en_oferta);
      const desde = (f.pagina - 1) * f.porPagina;
      return { filas: copia(r.slice(desde, desde + f.porPagina)), total: r.length };
    },
    async actualizar(id, campos, esperado) {
      const f = filas.find((x) => x.id === id);
      if (!f) return false;
      if (opciones.falla?.(id)) throw new Error("falla simulada");
      if (esperado) {
        if ("precio" in esperado && esperado.precio !== undefined && f.precio !== esperado.precio) return false;
        if ("precio_original" in esperado && (f.precio_original ?? null) !== (esperado.precio_original ?? null)) return false;
      }
      Object.assign(f, campos);
      contadores.escrituras++;
      return true;
    },
    async insertar(fila) {
      if (filas.some((f) => f.slug === fila.slug)) return { ok: false, motivo: "slug_repetido" };
      const nueva = ficha({ ...fila, id: nextId++ });
      filas.push(nueva);
      return { ok: true, ficha: copia(nueva) };
    },
    async existeSlug(slug) { return filas.some((f) => f.slug === slug); },
    async conteoPorCategoria() { const m = new Map(); for (const f of filas) if (f.activo && f.categoria_id != null) m.set(f.categoria_id, (m.get(f.categoria_id) ?? 0) + 1); return m; },
  };

  const cats = {
    async listar({ incluirInactivas }) { return copia(categorias.filter((c) => incluirInactivas || c.activa)); },
    async porIds(ids) { return copia(categorias.filter((c) => ids.includes(c.id))); },
    async insertar(fila) { const c = { id: 1000 + categorias.length, activa: true, ...fila }; categorias.push(c); return copia(c); },
    async actualizar(id, campos) { const c = categorias.find((x) => x.id === id); if (!c) return false; Object.assign(c, campos); return true; },
    async existeSlug(slug) { return categorias.some((c) => c.slug === slug); },
  };

  const zon = {
    async listar() { if (opciones.sinZonas) throw new Error("no existe"); return copia(zonas); },
    async actualizar(id, campos) { const z = zonas.find((x) => x.id === id); if (!z) return false; Object.assign(z, campos); return true; },
  };

  // Aprobaciones reales (D1 simulada) con correo capturado.
  const correos = [];
  const estadoAprobador = { email: opciones.aprobadorEmail === undefined ? "jorge@example.com" : opciones.aprobadorEmail, correoCae: false };
  const aprobacion = {
    solicitar: (db, datos) => solicitarAprobacion(db, datos, {
      base: "https://barraca.jurmaq.cl",
      get aprobadorEmail() { return estadoAprobador.email; },
      enviar: async (a) => { if (estadoAprobador.correoCae) return false; correos.push(a); return true; },
    }),
  };

  const deps = {
    productos, categorias: cats, zonas: zon, aprobacion,
    async revalidar(ids) { contadores.revalidados.push(ids); },
    async zonasCambiadas() { contadores.zonasInvalidadas++; },
  };
  return { deps, filas, categorias, zonas, correos, contadores, estadoAprobador };
}

/** Contexto de una llamada de herramienta, con la auditoría real sobre la D1 simulada. */
export function crearCtx(db, usuario, ahora, herramienta = "prueba") {
  const loteId = `lote-${Math.random().toString(36).slice(2, 10)}`;
  return {
    db, usuario, ahora, loteId, clienteId: "c1", catalogo: [],
    async auditar(cambios) { await registrarLote(db, loteId, usuario, cambios.map((c) => ({ herramienta: c.herramienta ?? herramienta, ...c })), ahora); },
  };
}

/** Aprueba como Jorge el último correo enviado (abre el enlace y toca Aprobar). */
export async function aprobarUltimoCorreo(db, correos, resolverAprobacion) {
  const aviso = correos[correos.length - 1];
  const token = aviso.enlace.split("/aprobar/")[1];
  return resolverAprobacion(db, token, "aprobar");
}
