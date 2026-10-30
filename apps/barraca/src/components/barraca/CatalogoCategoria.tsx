"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/barraca/Enlace";
import ProductCard from "@/components/barraca/ProductCard";
import OrdenarSelect from "@/components/barraca/OrdenarSelect";

/**
 * Filtros, grilla y paginación de una categoría.
 *
 * La página llega estática desde la CDN con la página 1 ordenada por nombre
 * (eso es lo que ven Google y quien entra sin filtros). Cuando el cliente
 * cambia el orden, el stock, el precio o la página, este componente escribe
 * los filtros en la URL con history.pushState y pide la grilla a
 * /api/catalogo, que también sale de caché. El servidor no vuelve a renderizar
 * la página.
 *
 * Los filtros se leen de window.location y no con useSearchParams a propósito:
 * useSearchParams en una página estática obliga a envolverla en Suspense y la
 * grilla desaparece del HTML que lee Google.
 */

type Orden = "nombre" | "precio_asc" | "precio_desc" | "stock_desc";
type Stock = "all" | "instock" | "outofstock";

interface Filtros {
  page: number;
  sort: Orden;
  stock: Stock;
  min: string;
  max: string;
}

export interface ProductoGrilla {
  id: number;
  codigo: string | null;
  nombre: string;
  slug: string;
  precio: number;
  precio_original: number | null;
  en_oferta: boolean | null;
  solo_cotizar: boolean | null;
  stock: number | null;
  unidad: string | null;
  imagen: string | null;
  medida: string | null;
}

export interface Subcategoria {
  id: number;
  nombre: string;
  slug: string;
  product_count: number;
}

const DEFECTO: Filtros = { page: 1, sort: "nombre", stock: "all", min: "", max: "" };
const ORDENES: Orden[] = ["nombre", "precio_asc", "precio_desc", "stock_desc"];
const STOCKS: Stock[] = ["all", "instock", "outofstock"];

function leerUrl(): Filtros {
  const q = new URLSearchParams(window.location.search);
  const page = Number.parseInt(q.get("page") ?? "1", 10);
  const sort = q.get("sort") as Orden | null;
  const stock = q.get("stock") as Stock | null;
  const precio = (v: string | null) => (v && /^\d{1,10}$/.test(v) ? v : "");
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    sort: sort && ORDENES.includes(sort) ? sort : "nombre",
    stock: stock && STOCKS.includes(stock) ? stock : "all",
    min: precio(q.get("min")),
    max: precio(q.get("max")),
  };
}

function queryDe(f: Filtros): string {
  const q = new URLSearchParams();
  if (f.page > 1) q.set("page", String(f.page));
  if (f.sort !== "nombre") q.set("sort", f.sort);
  if (f.stock !== "all") q.set("stock", f.stock);
  if (f.min) q.set("min", f.min);
  if (f.max) q.set("max", f.max);
  const s = q.toString();
  return s ? `?${s}` : "";
}

const esDefecto = (f: Filtros) => queryDe(f) === "";

export default function CatalogoCategoria({
  slug,
  nombre,
  subcats,
  inicial,
  totalInicial,
  porPagina,
}: {
  slug: string;
  nombre: string;
  subcats: Subcategoria[];
  inicial: ProductoGrilla[];
  totalInicial: number;
  porPagina: number;
}) {
  const [filtros, setFiltros] = useState<Filtros>(DEFECTO);
  const [productos, setProductos] = useState<ProductoGrilla[]>(inicial);
  const [total, setTotal] = useState(totalInicial);
  const [cargando, setCargando] = useState(false);
  // Panel de filtros del celular. Abierto, la página de atrás no se desliza
  // y Escape lo cierra.
  const [panel, setPanel] = useState(false);
  useEffect(() => {
    if (!panel) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alTecla = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(false); };
    window.addEventListener("keydown", alTecla);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alTecla);
    };
  }, [panel]);
  const [error, setError] = useState(false);
  const pedido = useRef(0);
  const grillaRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(
    async (f: Filtros) => {
      setFiltros(f);
      setError(false);
      if (esDefecto(f)) {
        setProductos(inicial);
        setTotal(totalInicial);
        return;
      }
      const id = ++pedido.current;
      setCargando(true);
      try {
        const q = new URLSearchParams(queryDe(f).slice(1));
        q.set("cat", slug);
        const r = await fetch(`/api/catalogo?${q.toString()}`);
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as { productos: ProductoGrilla[]; total: number };
        if (id !== pedido.current) return; // llegó tarde: hay un pedido más nuevo
        setProductos(d.productos);
        setTotal(d.total);
      } catch {
        if (id === pedido.current) setError(true);
      } finally {
        if (id === pedido.current) setCargando(false);
      }
    },
    [inicial, totalInicial, slug],
  );

  // Al entrar con filtros en la URL (link compartido, recarga) y al usar
  // atrás/adelante del navegador.
  useEffect(() => {
    const desdeUrl = leerUrl();
    if (!esDefecto(desdeUrl)) cargar(desdeUrl);
    const onPop = () => cargar(leerUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [cargar]);

  function aplicar(cambio: Partial<Filtros>, subir = false) {
    const f = { ...filtros, ...cambio };
    window.history.pushState(null, "", `/categorias/${slug}${queryDe(f)}`);
    cargar(f);
    if (subir) grillaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const filtrosActivos = (filtros.stock !== "all" ? 1 : 0) + (filtros.min || filtros.max ? 1 : 0);
  const hrefDe = (cambio: Partial<Filtros>) => `/categorias/${slug}${queryDe({ ...filtros, ...cambio })}`;
  const alClick = (cambio: Partial<Filtros>, subir = false) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // abrir en pestaña nueva
    e.preventDefault();
    aplicar(cambio, subir);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Filtros: en escritorio, columna fija a la izquierda. En celular, un
          panel que sube desde abajo al tocar "Filtrar" (como en las apps de
          las tiendas grandes): no empuja los productos ni ocupa la pantalla
          mientras no se usa. */}
      <div
        aria-hidden="true"
        onClick={() => setPanel(false)}
        className={`lg:hidden fixed inset-0 z-[60] bg-navy-950/40 transition-opacity duration-200 ${panel ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <aside
        id="panel-filtros"
        aria-label="Filtros"
        className={`w-full lg:w-64 shrink-0 fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto overscroll-contain bg-white rounded-t-2xl shadow-[0_-12px_40px_-12px_rgba(8,20,40,0.45)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${panel ? "translate-y-0" : "translate-y-full"} lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:bg-transparent lg:rounded-none lg:shadow-none lg:translate-y-0 lg:transition-none`}
      >
        <div className="lg:sticky lg:top-24">
          <div className="lg:hidden sticky top-0 bg-white flex items-center justify-between px-5 pt-3 pb-2 border-b border-gray-100">
            <span className="absolute left-1/2 top-1.5 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-300" aria-hidden="true" />
            <p className="text-base font-bold text-navy-950 pt-2">Filtrar</p>
            <button type="button" onClick={() => setPanel(false)} className="w-11 h-11 -mr-2 flex items-center justify-center text-gray-500" aria-label="Cerrar filtros">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-5 space-y-6 lg:rounded-xl lg:bg-white lg:border lg:border-gray-200">
            {subcats.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">
                  Subcategorías
                </h3>
                <ul className="space-y-1">
                  {subcats.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/categorias/${sub.slug}`}
                        className="flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-marca-50 hover:text-marca-600 rounded-lg transition-colors"
                      >
                        <span>{sub.nombre}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {sub.product_count}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">
                Disponibilidad
              </h3>
              <div className="space-y-1.5">
                {([
                  { value: "all", label: "Todos" },
                  { value: "instock", label: "Disponibles" },
                  { value: "outofstock", label: "No disponibles" },
                ] as { value: Stock; label: string }[]).map((opt) => (
                  <a
                    key={opt.value}
                    href={hrefDe({ stock: opt.value, page: 1 })}
                    onClick={alClick({ stock: opt.value, page: 1 })}
                    rel="nofollow"
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                      filtros.stock === opt.value
                        ? "bg-marca-50 text-marca-700 font-semibold border border-marca-200"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      filtros.stock === opt.value ? "border-marca-600 bg-marca-600" : "border-gray-300"
                    }`}>
                      {filtros.stock === opt.value && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {opt.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-navy-950 uppercase tracking-wider mb-3">
                Rango de precio
              </h3>
              <form
                key={`${filtros.min}-${filtros.max}`}
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const datos = new FormData(e.currentTarget);
                  const limpio = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\D/g, "").slice(0, 10);
                  aplicar({ min: limpio(datos.get("min")), max: limpio(datos.get("max")), page: 1 });
                }}
              >
                <div className="flex gap-2 items-center">
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                    <input
                      type="number"
                      name="min"
                      placeholder="Min"
                      defaultValue={filtros.min}
                      inputMode="numeric"
                      className="w-full h-11 min-h-[44px] pl-6 pr-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-marca-500 focus:border-marca-500"
                    />
                  </div>
                  <span className="text-gray-300 shrink-0">-</span>
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                    <input
                      type="number"
                      name="max"
                      placeholder="Max"
                      defaultValue={filtros.max}
                      inputMode="numeric"
                      className="w-full h-11 min-h-[44px] pl-6 pr-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-marca-500 focus:border-marca-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full h-11 min-h-[44px] bg-navy-950 hover:bg-[#111111] text-white text-sm font-medium tracking-[0.02em] rounded-lg transition-colors touch-manipulation"
                >
                  Aplicar filtro
                </button>
                {(filtros.min || filtros.max) && (
                  <a
                    href={hrefDe({ min: "", max: "", page: 1 })}
                    onClick={alClick({ min: "", max: "", page: 1 })}
                    rel="nofollow"
                    className="block text-center text-xs text-[#787774] hover:text-[#111111] font-medium underline-offset-4"
                  >
                    Limpiar filtro de precio
                  </a>
                )}
              </form>
            </div>
          </div>
          <div className="lg:hidden sticky bottom-0 bg-white border-t border-gray-100 p-4 safe-bottom">
            <button type="button" onClick={() => setPanel(false)} className="w-full h-12 rounded-xl bg-navy-950 text-white font-semibold">
              Ver {total} producto{total !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1" ref={grillaRef} style={{ scrollMarginTop: "7rem" }}>
        <div className="lg:border-b lg:border-[#EAEAEA] pb-3 lg:pb-6 mb-4 lg:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-3">
                Categoría
              </p>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-navy-950 leading-tight mb-1">
                {nombre}
              </h1>
              <p className="text-sm text-[#787774]" aria-live="polite">
                <span className="font-semibold text-[#111111] mr-1" style={{ fontWeight: 400 }}>{total}</span>
                producto{total !== 1 ? "s" : ""}
                {filtros.stock === "instock" ? " disponibles" : filtros.stock === "outofstock" ? " no disponibles" : ""}
              </p>
            </div>
            <div className="shrink-0 hidden lg:block">
              <OrdenarSelect actual={filtros.sort} onChange={(v) => aplicar({ sort: v as Orden, page: 1 })} />
            </div>
          </div>
          {subcats.length > 0 && (
            <ul className="lg:hidden flex gap-2 overflow-x-auto riel -mx-4 px-4 mt-4">
              {subcats.map((sub) => (
                <li key={sub.id} className="shrink-0">
                  <Link href={`/categorias/${sub.slug}`} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white border border-gray-200 text-[13px] font-medium text-navy-950">
                    {sub.nombre}
                    <span className="text-gray-400 tabular-nums">{sub.product_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Celular: barra fija "Filtrar · Ordenar", siempre a mano al bajar. */}
        <div className="lg:hidden sticky top-[env(safe-area-inset-top)] z-30 -mx-4 px-4 py-2 mb-4 bg-[#F7F7F5]/95 backdrop-blur-md border-y border-gray-200/70 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanel(true)}
            aria-controls="panel-filtros"
            aria-expanded={panel}
            className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-300 text-sm font-semibold text-navy-950 active:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M10 18h4" /></svg>
            Filtrar
            {filtrosActivos > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-marca-600 text-white text-[11px] font-bold inline-flex items-center justify-center">{filtrosActivos}</span>
            )}
          </button>
          <div className="flex-1">
            <OrdenarSelect compacto actual={filtros.sort} onChange={(v) => aplicar({ sort: v as Orden, page: 1 })} />
          </div>
        </div>

        {error ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <p className="text-gray-600 mb-4">No pudimos cargar los productos.</p>
            <button
              type="button"
              onClick={() => cargar(filtros)}
              className="text-sm font-semibold text-marca-600 hover:text-marca-700"
            >
              Reintentar
            </button>
          </div>
        ) : productos.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className="text-gray-500 mb-4">
              {esDefecto(filtros) ? "No hay productos en esta categoria" : "Ningún producto cumple estos filtros"}
            </p>
            {esDefecto(filtros) ? (
              <Link href="/categorias" className="text-sm font-semibold text-marca-600 hover:text-marca-700">
                Ver otras categorias
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => aplicar(DEFECTO)}
                className="text-sm font-semibold text-marca-600 hover:text-marca-700"
              >
                Quitar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className={`grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 transition-opacity duration-150 ${cargando ? "opacity-50" : "opacity-100"}`}
              aria-busy={cargando}
            >
              {productos.map((p) => (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  nombre={p.nombre}
                  codigo={p.codigo}
                  slug={p.slug}
                  precio={p.precio}
                  precio_original={p.precio_original}
                  en_oferta={p.en_oferta ?? undefined}
                  solo_cotizar={p.solo_cotizar ?? undefined}
                  imagen={p.imagen}
                  stock={p.stock ?? 0}
                  unidad={p.unidad}
                  medida={p.medida}
                  categoriaSlug={slug}
                />
              ))}
            </div>

            {totalPaginas > 1 && (
              <nav aria-label="Paginacion" className="flex items-center justify-center gap-1.5 mt-10">
                {filtros.page > 1 && (
                  <a
                    href={hrefDe({ page: filtros.page - 1 })}
                    onClick={alClick({ page: filtros.page - 1 }, true)}
                    className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-marca-50 hover:border-marca-300 hover:text-marca-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Anterior
                  </a>
                )}
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPaginas || Math.abs(n - filtros.page) <= 2)
                  .map((n, idx, arr) => (
                    <span key={n} className="inline-flex items-center">
                      {idx > 0 && arr[idx - 1] !== n - 1 && (
                        <span className="px-1.5 text-gray-500 select-none">...</span>
                      )}
                      <a
                        href={hrefDe({ page: n })}
                        onClick={alClick({ page: n }, true)}
                        aria-current={n === filtros.page ? "page" : undefined}
                        className={`w-10 h-10 flex items-center justify-center text-sm font-semibold rounded-lg transition-colors ${
                          n === filtros.page
                            ? "bg-marca-600 text-white shadow-sm"
                            : "bg-white border border-gray-300 text-gray-700 hover:bg-marca-50 hover:border-marca-300 hover:text-marca-600"
                        }`}
                      >
                        {n}
                      </a>
                    </span>
                  ))}
                {filtros.page < totalPaginas && (
                  <a
                    href={hrefDe({ page: filtros.page + 1 })}
                    onClick={alClick({ page: filtros.page + 1 }, true)}
                    className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-marca-50 hover:border-marca-300 hover:text-marca-600 transition-colors"
                  >
                    Siguiente
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </a>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
