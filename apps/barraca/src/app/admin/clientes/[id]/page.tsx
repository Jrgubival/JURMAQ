"use client"

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface Cliente {
  id: number;
  nombre: string | null;
  email: string;
  telefono: string | null;
  empresa: string | null;
  rut: string | null;
  rol: string | null;
  activo: boolean;
  created_at: string;
}

interface Stats {
  ltv: number;
  aov: number;
  total_cotizaciones: number;
  total_pagadas: number;
  total_canceladas: number;
  ultima_compra_at: string | null;
  dias_sin_comprar: number | null;
  reviews_publicadas: number;
  wishlist_count: number;
  referidos_por_maestros: string[];
}

interface Cotizacion {
  id: number;
  numero: string;
  estado: string;
  total: number;
  codigo_maestro: string | null;
  created_at: string;
  pagada_at: string | null;
}

interface TopProducto {
  producto_id: number;
  nombre: string;
  slug?: string;
  cantidad_total: number;
  ultima_compra: string;
}

interface Review {
  id: string;
  rating: number;
  titulo: string | null;
  estado: string;
  created_at: string;
  barraca_productos: { nombre: string; slug: string } | null;
}

interface WishlistItem {
  id: string;
  producto_id: number;
  barraca_productos: { id: number; nombre: string; slug: string; precio: number; imagen: string | null; stock: number } | null;
}

interface CarritoAbandonado {
  id: string;
  items: unknown;
  total: number;
  last_activity: string;
  recovery_count: number;
  converted_at: string | null;
}

interface Data360 {
  cliente: Cliente;
  stats: Stats;
  cotizaciones: Cotizacion[];
  top_productos: TopProducto[];
  reviews: Review[];
  wishlist: WishlistItem[];
  carrito_abandonado: CarritoAbandonado | null;
}

const ESTADO_COLOR: Record<string, string> = {
  pagada: 'bg-green-100 text-green-700',
  pendiente: 'bg-amber-100 text-amber-700',
  enviada: 'bg-blue-100 text-blue-700',
  aprobada: 'bg-blue-100 text-blue-700',
  rechazada: 'bg-gray-100 text-gray-500',
  contraoferta: 'bg-purple-100 text-purple-700',
  anulada: 'bg-gray-100 text-gray-500',
  cancelada: 'bg-gray-100 text-gray-500',
};

export default function ClienteDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data360 | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/clientes/${id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }

  const fmt = (n: number) => `$${Number(n).toLocaleString('es-CL')}`;

  if (loading) return <div className="p-6">Cargando…</div>;
  if (!data) return <div className="p-6">Cliente no encontrado</div>;

  const { cliente, stats, cotizaciones, top_productos, reviews, wishlist, carrito_abandonado } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link href="/admin/clientes" className="text-sm text-orange-600 hover:underline">
        ← Volver al listado
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start mt-3 mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cliente.nombre || cliente.email}</h1>
          <p className="text-sm text-gray-500 mt-1">
            <a href={`mailto:${cliente.email}`} className="text-blue-600 hover:underline">
              {cliente.email}
            </a>
            {cliente.telefono && (
              <>
                {' · '}
                <a href={`tel:${cliente.telefono}`} className="text-blue-600 hover:underline">
                  {cliente.telefono}
                </a>
                {' · '}
                <a
                  href={`https://wa.me/${cliente.telefono.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  WhatsApp
                </a>
              </>
            )}
          </p>
          {cliente.empresa && (
            <p className="text-xs text-gray-500 mt-1">
              {cliente.empresa} {cliente.rut && `· ${cliente.rut}`}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Cliente desde {new Date(cliente.created_at).toLocaleDateString('es-CL')}
            {!cliente.activo && (
              <span className="ml-2 inline-block px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded-full">
                Inactivo
              </span>
            )}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">LTV</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(stats.ltv)}</p>
          <p className="text-xs text-gray-500 mt-1">AOV: {fmt(stats.aov)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700">Compras pagadas</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{stats.total_pagadas}</p>
          <p className="text-xs text-blue-600 mt-1">
            de {stats.total_cotizaciones} cotizaciones
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700">Última compra</p>
          <p className="text-base font-bold text-amber-900 mt-1">
            {stats.dias_sin_comprar === null
              ? '— sin compras'
              : stats.dias_sin_comprar === 0
              ? 'Hoy'
              : `Hace ${stats.dias_sin_comprar}d`}
          </p>
          {stats.ultima_compra_at && (
            <p className="text-xs text-amber-600 mt-1">
              {new Date(stats.ultima_compra_at).toLocaleDateString('es-CL')}
            </p>
          )}
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs text-purple-700">Engagement</p>
          <p className="text-base font-bold text-purple-900 mt-1">
            {stats.reviews_publicadas} review{stats.reviews_publicadas !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-purple-600 mt-1">
            {stats.wishlist_count} en wishlist
          </p>
        </div>
      </div>

      {/* Referidos por maestro */}
      {stats.referidos_por_maestros.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-orange-900">
            👷 <strong>Referido por maestro{stats.referidos_por_maestros.length > 1 ? 's' : ''}:</strong>{' '}
            {stats.referidos_por_maestros.map((c) => (
              <code key={c} className="ml-1 px-2 py-0.5 bg-white border border-orange-200 rounded font-mono text-xs">
                {c}
              </code>
            ))}
          </p>
        </div>
      )}

      {/* Carrito abandonado activo */}
      {carrito_abandonado && !carrito_abandonado.converted_at && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-900">
            🛒 <strong>Carrito abandonado:</strong> {fmt(carrito_abandonado.total)} · Última actividad{' '}
            {new Date(carrito_abandonado.last_activity).toLocaleDateString('es-CL')} ·{' '}
            {carrito_abandonado.recovery_count} recovery email
            {carrito_abandonado.recovery_count !== 1 ? 's' : ''} enviado
            {carrito_abandonado.recovery_count !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historial cotizaciones */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Historial ({cotizaciones.length})</h2>
          </div>
          {cotizaciones.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">Sin cotizaciones.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {cotizaciones.map((c) => (
                    <tr key={c.id}>
                      <td className="px-4 py-2">
                        <Link
                          href={`/admin/cotizaciones/${c.id}`}
                          className="font-mono text-xs text-orange-600 hover:underline"
                        >
                          {c.numero}
                        </Link>
                        <div className="text-[10px] text-gray-500">
                          {new Date(c.created_at).toLocaleDateString('es-CL')}
                          {c.codigo_maestro && (
                            <span className="ml-1 text-orange-600">· {c.codigo_maestro}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ESTADO_COLOR[c.estado] ?? 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">
                        {fmt(c.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top productos */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Productos favoritos (top 5)</h2>
          </div>
          {top_productos.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">Sin compras aún.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {top_productos.map((p) => (
                <li key={p.producto_id} className="px-4 py-3 flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    {p.slug ? (
                      <Link
                        href={`/producto/${p.slug}`}
                        target="_blank"
                        className="text-sm font-medium text-gray-900 hover:text-orange-600 truncate"
                      >
                        {p.nombre}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Última: {new Date(p.ultima_compra).toLocaleDateString('es-CL')}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-orange-600">×{p.cantidad_total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Reviews */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Reviews ({reviews.length})</h2>
          </div>
          {reviews.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">Sin reviews aún.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {reviews.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {'★'.repeat(r.rating)}
                      {'☆'.repeat(5 - r.rating)}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        r.estado === 'aprobada'
                          ? 'bg-green-100 text-green-700'
                          : r.estado === 'pendiente'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {r.estado}
                    </span>
                  </div>
                  {r.barraca_productos && (
                    <p className="text-xs text-gray-500">{r.barraca_productos.nombre}</p>
                  )}
                  {r.titulo && (
                    <p className="text-sm font-medium text-gray-700 mt-1">{r.titulo}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Wishlist */}
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Wishlist ({wishlist.length})</h2>
          </div>
          {wishlist.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">Wishlist vacía.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {wishlist.map((w) => (
                <li key={w.id} className="px-4 py-3 flex justify-between items-center">
                  <div className="flex-1 min-w-0">
                    {w.barraca_productos ? (
                      <Link
                        href={`/producto/${w.barraca_productos.slug}`}
                        target="_blank"
                        className="text-sm font-medium text-gray-900 hover:text-orange-600 truncate"
                      >
                        {w.barraca_productos.nombre}
                      </Link>
                    ) : (
                      <p className="text-sm text-gray-500">(producto borrado)</p>
                    )}
                    {w.barraca_productos && (
                      <p className="text-xs text-gray-500">
                        {fmt(w.barraca_productos.precio)} · stock {w.barraca_productos.stock}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
