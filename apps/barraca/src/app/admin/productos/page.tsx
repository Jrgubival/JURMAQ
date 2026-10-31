"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * /admin/productos — buscar un producto y marcarlo disponible o no disponible.
 *
 * Regla de la tienda (lib/stock.ts): se puede comprar si tiene precio web y
 * stock ≥ 1. "No disponible" deja el stock en 0; "Disponible" pide cuántas
 * unidades hay. El precio no se cambia acá (lo carga la planilla de precios).
 * La API (/api/admin/productos/[id]/disponibilidad) sólo escribe el stock.
 *
 * El editor completo de fichas sigue en /admin/catalogo.
 */

interface Producto {
  id: number;
  codigo: string | null;
  nombre: string;
  slug: string;
  medida: string | null;
  unidad: string | null;
  precio: number;
  stock: number | null;
  imagen: string | null;
  soloCotizar: boolean;
  disponible: boolean;
}

type Ver = "todos" | "disponibles" | "no_disponibles";

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const stockTexto = (s: number | null) => (s == null ? "sin dato" : Number.isInteger(s) ? String(s) : s.toLocaleString("es-CL"));

export default function ProductosTiendaPage() {
  const [q, setQ] = useState("");
  const [ver, setVer] = useState<Ver>("todos");
  const [lista, setLista] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [pidiendoStock, setPidiendoStock] = useState<{ id: number; valor: string } | null>(null);
  const pedido = useRef(0);

  const cargar = useCallback(async (texto: string, filtro: Ver) => {
    const n = ++pedido.current;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/productos/buscar?q=${encodeURIComponent(texto)}&ver=${filtro}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (n !== pedido.current) return; // llegó una búsqueda más nueva
      if (res.ok) setLista(data.productos || []);
      else setError(data.error || "No se pudieron cargar los productos");
    } catch {
      if (n === pedido.current) setError("Sin conexión. Revisa el internet y vuelve a intentar.");
    }
    if (n === pedido.current) setCargando(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void cargar(q, ver), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, ver, cargar]);

  async function guardar(p: Producto, body: { disponible: false } | { disponible: true; stock: number }) {
    setGuardando(p.id);
    setAviso(null);
    const res = await fetch(`/api/admin/productos/${p.id}/disponibilidad`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setGuardando(null);
    if (!res?.ok) {
      alert(data.error || "No se pudo guardar");
      return;
    }
    setPidiendoStock(null);
    if (data.aviso) setAviso(data.aviso);
    setLista((l) => l.map((x) => (x.id === p.id ? { ...x, stock: data.stock, disponible: !!data.disponible } : x)));
  }

  function marcarNoDisponible(p: Producto) {
    if (!confirm(`¿Marcar "${p.nombre}" como NO disponible? Su stock queda en 0 y no se podrá comprar en la página.`)) return;
    void guardar(p, { disponible: false });
  }

  function confirmarStock(p: Producto) {
    const v = pidiendoStock?.valor.trim() ?? "";
    const n = Number(v);
    if (!/^\d+$/.test(v) || !Number.isInteger(n) || n < 1 || n > 100000) {
      alert("Escribe cuántas unidades hay (un número entero mayor que 0).");
      return;
    }
    void guardar(p, { disponible: true, stock: n });
  }

  const filtros: Array<{ id: Ver; label: string }> = [
    { id: "todos", label: "Todos" },
    { id: "disponibles", label: "Disponibles" },
    { id: "no_disponibles", label: "No disponibles" },
  ];

  return (
    <div>
      <label className="block mb-3">
        <span className="sr-only">Buscar producto</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o código"
          className="w-full min-h-[44px] px-3 rounded-xl border border-gray-300 bg-white text-base text-gray-900"
        />
      </label>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filtrar">
        {filtros.map((f) => (
          <button
            key={f.id}
            onClick={() => setVer(f.id)}
            aria-pressed={ver === f.id}
            className={`min-h-[44px] px-4 rounded-full text-sm font-semibold border ${
              ver === f.id ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300"
            }`}
          >
            {f.label}
          </button>
        ))}
        <Link href="/admin/catalogo" className="min-h-[44px] px-4 flex items-center text-sm font-semibold text-orange-700 ml-auto">
          Editar fichas
        </Link>
      </div>

      {aviso && <p className="mb-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{aviso}</p>}
      {error && <p className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

      {cargando && lista.length === 0 ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-2xl p-8 text-center">No encontramos productos{q ? ` con "${q}"` : ""}.</p>
      ) : (
        <ul className={`space-y-2 ${cargando ? "opacity-60" : ""}`}>
          {lista.map((p) => {
            const ocupado = guardando === p.id;
            const pidiendo = pidiendoStock?.id === p.id;
            return (
              <li key={p.id} className="bg-white border border-gray-200 rounded-2xl p-3">
                <div className="flex gap-3">
                  {p.imagen ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagen} alt="" width={56} height={56} loading="lazy" className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0" />
                  ) : (
                    <span className="w-14 h-14 rounded-lg bg-gray-100 shrink-0" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 leading-snug break-words">{p.nombre}{p.medida ? ` ${p.medida}` : ""}</p>
                    <p className="text-xs text-gray-500">{p.codigo ? `Código ${p.codigo}` : "Sin código"}</p>
                    <p className="mt-1 text-sm text-gray-800">
                      <span className="font-bold tabular-nums">{p.precio > 0 ? fmt(p.precio) : "Sin precio"}</span>
                      <span className="text-gray-400"> · </span>
                      Stock {stockTexto(p.stock)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${p.disponible ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                    {p.disponible ? "Disponible" : p.soloCotizar ? "Sólo cotizar" : p.precio > 0 ? "No disponible" : "No disponible (sin precio)"}
                  </span>
                  {!pidiendo && (
                    p.disponible ? (
                      <button disabled={ocupado} onClick={() => marcarNoDisponible(p)} className="min-h-[44px] px-4 rounded-xl text-sm font-semibold border border-gray-300 text-gray-800 disabled:opacity-60">
                        {ocupado ? "Guardando…" : "Marcar no disponible"}
                      </button>
                    ) : (
                      <button disabled={ocupado} onClick={() => setPidiendoStock({ id: p.id, valor: "" })} className="min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-gray-900 text-white disabled:opacity-60">
                        Marcar disponible
                      </button>
                    )
                  )}
                </div>

                {pidiendo && (
                  <form
                    className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2 items-end"
                    onSubmit={(e) => { e.preventDefault(); confirmarStock(p); }}
                  >
                    <label className="text-xs text-gray-600">¿Cuántas unidades hay?
                      <input
                        autoFocus
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={pidiendoStock.valor}
                        onChange={(e) => setPidiendoStock({ id: p.id, valor: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        className="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-gray-300 text-base text-gray-900"
                      />
                    </label>
                    <button type="button" onClick={() => setPidiendoStock(null)} className="min-h-[44px] px-3 rounded-xl text-sm text-gray-600">Volver</button>
                    <button type="submit" disabled={ocupado} className="min-h-[44px] px-4 rounded-xl text-sm font-semibold bg-gray-900 text-white disabled:opacity-60">
                      {ocupado ? "…" : "Guardar"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {lista.length >= 60 && <p className="mt-3 text-xs text-gray-500 text-center">Se muestran los primeros 60. Escribe más para afinar la búsqueda.</p>}
    </div>
  );
}
