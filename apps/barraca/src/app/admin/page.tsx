'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCLP, formatDate } from '@jurmaq/shared/format';

/**
 * Dashboard landing del panel Barraca admin.
 *
 * Vive en /admin/barraca para que ese sea el "home" del flujo barraca,
 * separado del dashboard de constructora (/admin) que ya existía.
 *
 * Muestra:
 *  - 4 KPIs actuales del e-commerce (cotizaciones nuevas, productos
 *    activos, suscriptores, promociones vigentes)
 *  - Atajos a las acciones más frecuentes (cotizaciones, importar Excel,
 *    revisar precios, gestionar promociones)
 *  - Últimas cotizaciones para que el vendedor las vea de un vistazo
 */

interface BarracaStats {
  cotizacionesNuevas: number;
  productosActivos: number;
  suscriptores: number;
  promocionesActivas: number;
}

interface CotizacionRow {
  id: number;
  numero: string;
  nombre: string;
  total: number;
  estado: string;
  created_at: string;
}

const ESTADO_COLOR: Record<string, string> = {
  nueva: 'bg-blue-100 text-blue-700',
  abierta: 'bg-blue-100 text-blue-700',
  contraoferta_enviada: 'bg-amber-100 text-amber-700',
  aceptada: 'bg-green-100 text-green-700',
  pagada: 'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-700',
  cerrada: 'bg-gray-100 text-gray-700',
};

const ATAJOS = [
  {
    href: '/admin/barraca/cotizaciones',
    titulo: 'Cotizaciones',
    descripcion: 'Atender cotizaciones nuevas, enviar contraofertas',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
      </svg>
    ),
  },
  {
    href: '/admin/barraca/promociones',
    titulo: 'Promociones',
    descripcion: 'Activar ofertas y subir Excel de promociones',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    ),
  },
  {
    href: '/admin/barraca/precios',
    titulo: 'Precios',
    descripcion: 'Revisar y ajustar precios del catálogo',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
  },
  {
    href: '/admin/barraca/importar',
    titulo: 'Importar',
    descripcion: 'Subir catálogo masivo desde Excel',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
  },
];

export default function BarracaAdminDashboard() {
  const [stats, setStats] = useState<BarracaStats | null>(null);
  const [cotizaciones, setCotizaciones] = useState<CotizacionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      try {
        // Best-effort fetch: si algún endpoint no soporta el filtro o falla,
        // ese KPI queda en 0 y no rompe la UI. Los routes auth-gated (admin)
        // requieren cookie de sesión; credentials:'include' garantiza el envío.
        const [cotizRes, prodRes, subsRes, promoRes] = await Promise.all([
          fetch('/api/barraca/cotizaciones?limit=10', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('/api/barraca/productos?limit=1', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('/api/barraca/suscriptores?limit=1', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetch('/api/barraca/promociones?activa=1', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ]);
        if (cancelled) return;

        const cotizItems: CotizacionRow[] = Array.isArray(cotizRes)
          ? cotizRes
          : cotizRes?.cotizaciones || cotizRes?.items || [];
        setCotizaciones(cotizItems.slice(0, 8));
        const nuevas = cotizItems.filter((c) => c.estado === 'nueva' || c.estado === 'abierta').length;

        const productosCount = prodRes?.total ?? prodRes?.count
          ?? (Array.isArray(prodRes?.productos) ? prodRes.productos.length : 0);
        const suscriptoresCount = subsRes?.total ?? subsRes?.count
          ?? (Array.isArray(subsRes?.suscriptores) ? subsRes.suscriptores.length : 0);
        const promosCount = Array.isArray(promoRes?.promociones)
          ? promoRes.promociones.length
          : Array.isArray(promoRes)
          ? promoRes.length
          : promoRes?.count ?? 0;

        setStats({
          cotizacionesNuevas: nuevas,
          productosActivos: productosCount,
          suscriptores: suscriptoresCount,
          promocionesActivas: promosCount,
        });
      } catch (err) {
        console.error('[barraca-dashboard]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-navy-950">Panel Barraca</h1>
          <p className="text-sm text-gray-500 mt-1">
            Operación día a día del e-commerce JURMAQ Barraca.
          </p>
        </div>
        <a
          href="https://barraca.jurmaq.cl"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-gray-300 hover:border-orange-400 text-gray-700 hover:text-orange-700 rounded-lg transition-colors"
        >
          Ver sitio público
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Cotizaciones nuevas', value: stats?.cotizacionesNuevas ?? 0, accent: 'text-orange-600' },
          { label: 'Productos activos', value: stats?.productosActivos ?? 0, accent: 'text-navy-950' },
          { label: 'Suscriptores', value: stats?.suscriptores ?? 0, accent: 'text-navy-950' },
          { label: 'Promociones activas', value: stats?.promocionesActivas ?? 0, accent: 'text-navy-950' },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-5">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{k.label}</p>
            <p className={`text-3xl font-extrabold tabular-nums ${k.accent}`}>
              {loading ? '—' : k.value.toLocaleString('es-CL')}
            </p>
          </div>
        ))}
      </div>

      {/* Atajos */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Atajos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ATAJOS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group bg-white hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl p-4 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center mb-3 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                {a.icon}
              </div>
              <p className="font-semibold text-navy-950 group-hover:text-orange-700">{a.titulo}</p>
              <p className="text-xs text-gray-500 mt-0.5">{a.descripcion}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Últimas cotizaciones */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Últimas cotizaciones</h2>
          <Link href="/admin/barraca/cotizaciones" className="text-xs font-semibold text-orange-700 hover:text-orange-800">
            Ver todas →
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Cargando…</div>
          ) : cotizaciones.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">Sin cotizaciones aún.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {cotizaciones.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/admin/barraca/cotizaciones?id=${c.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy-950 truncate">
                        {c.numero} · {c.nombre}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(c.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-navy-950 tabular-nums">{formatCLP(c.total)}</p>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${
                          ESTADO_COLOR[c.estado] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {c.estado}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
