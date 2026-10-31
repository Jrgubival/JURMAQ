"use client"

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { can, type Module, type Action } from '@jurmaq/shared/roles';
import { ADMIN_NAV, adminHref, esExterno } from '@jurmaq/shared/admin/nav';
import CommandPalette from '@jurmaq/shared/ui/CommandPalette';
import { env } from '@jurmaq/shared/env';
import NotificationsBell from './NotificationsBell';

/**
 * AdminShell — panel de la tienda en línea de la barraca (barraca.jurmaq.cl/admin).
 *
 * Pensado para usarse en el celular en el local: cuatro secciones fijas
 * (Resumen, Pedidos, Productos, Despacho) en una barra inferior en el
 * teléfono y en una barra lateral en el computador. El resto de las
 * herramientas (importar precios, imágenes, cotizaciones, el panel de
 * arriendo, etc.) sigue existiendo y con sus permisos, pero queda dentro de
 * "Más herramientas" para no estorbar.
 *
 * La visibilidad es sólo comodidad: cada página y cada /api/admin/* valida el
 * permiso en el servidor.
 */

interface ItemTienda {
  label: string;
  href: string;
  module: Module;
  action?: Action;
  icon: React.ReactNode;
}

const ic = (d: string) => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const TIENDA: ItemTienda[] = [
  { label: 'Resumen', href: '/admin', module: 'barraca_cotizaciones', icon: ic('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1') },
  { label: 'Pedidos', href: '/admin/pedidos', module: 'barraca_cotizaciones', icon: ic('M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z') },
  { label: 'Productos', href: '/admin/productos', module: 'barraca_productos', icon: ic('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4') },
  { label: 'Despacho', href: '/admin/despacho', module: 'barraca_precios', icon: ic('M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0') },
];

/** Rutas propias de la tienda (no se repiten en "Más herramientas"). */
const RUTAS_TIENDA = new Set(['/admin/pedidos', '/admin/productos', '/admin/dashboard']);

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [masAbierto, setMasAbierto] = useState(false);
  const pathname = usePathname() || '';
  const router = useRouter();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const constructoraUrl = env.NEXT_PUBLIC_CONSTRUCTORA_URL || undefined;

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : pathname.startsWith(href));

  const tienda = TIENDA.filter((it) => !session || can(role, it.module, it.action ?? 'read'));
  const otras = ADMIN_NAV.filter(
    (it) => can(role, it.module, it.action ?? 'read') && !(it.app === 'barraca' && RUTAS_TIENDA.has(it.path)),
  );
  const titulo = TIENDA.find((it) => isActive(it.href))?.label
    ?? ADMIN_NAV.find((it) => it.app === 'barraca' && pathname.startsWith(it.path) && it.path !== '/admin')?.label
    ?? 'Panel';

  const listaOtras = (
    <ul className="space-y-1">
      {otras.map((item) => {
        const externo = esExterno(item, 'barraca');
        const href = adminHref(item, 'barraca', { constructora: constructoraUrl });
        return (
          <li key={`${item.app}${item.path}`}>
            <Link
              href={href}
              onClick={() => setMasAbierto(false)}
              className="flex items-center justify-between min-h-[44px] px-3 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
            >
              <span>{item.label}</span>
              {externo && <span className="text-[11px] text-gray-400">jurmaq.cl ↗</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      {/* Barra lateral (computador) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white border-r border-gray-200">
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
          <span className="w-9 h-9 rounded-lg bg-orange-600 text-white font-black flex items-center justify-center">B</span>
          <div className="leading-tight">
            <p className="font-bold text-gray-900">Tienda Barraca</p>
            <p className="text-xs text-gray-500">Panel JURMAQ</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Secciones de la tienda">
          <ul className="space-y-1">
            {tienda.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={isActive(it.href) ? 'page' : undefined}
                  className={`flex items-center gap-3 min-h-[44px] px-3 rounded-lg text-sm font-semibold ${
                    isActive(it.href) ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {it.icon}
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
          {otras.length > 0 && (
            <details className="mt-6 pt-4 border-t border-gray-100 group">
              <summary className="cursor-pointer list-none flex items-center justify-between min-h-[44px] px-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                Más herramientas
                <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="mt-1">{listaOtras}</div>
            </details>
          )}
        </nav>
        <div className="px-3 py-3 border-t border-gray-100">
          <p className="px-3 text-xs text-gray-500 truncate">{session?.user?.email || ''}</p>
          <button onClick={handleSignOut} className="mt-1 w-full text-left min-h-[44px] px-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 h-14 lg:h-16 px-4 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="lg:hidden w-8 h-8 rounded-lg bg-orange-600 text-white text-sm font-black flex items-center justify-center shrink-0">B</span>
            <h1 className="text-base lg:text-lg font-bold text-gray-900 truncate">{titulo}</h1>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              className="lg:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
              aria-label="Más herramientas y cerrar sesión"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </header>

        {/* pb para que la barra inferior no tape el contenido en el celular */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-4 lg:px-8 lg:py-8 pb-24 lg:pb-8">{children}</main>
      </div>

      {/* Barra inferior (celular) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]"
        aria-label="Secciones de la tienda"
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${Math.max(tienda.length, 1)}, minmax(0, 1fr))` }}>
          {tienda.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={isActive(it.href) ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[60px] text-[11px] font-semibold ${
                  isActive(it.href) ? 'text-orange-700' : 'text-gray-500'
                }`}
              >
                {it.icon}
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Hoja "Más" (celular) */}
      {masAbierto && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Más herramientas">
          <button className="absolute inset-0 bg-black/40" aria-label="Cerrar" onClick={() => setMasAbierto(false)} />
          <div className="absolute bottom-0 inset-x-0 max-h-[80vh] overflow-y-auto bg-white rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-gray-900">Más herramientas</p>
              <button onClick={() => setMasAbierto(false)} className="min-w-[44px] min-h-[44px] text-gray-500" aria-label="Cerrar">✕</button>
            </div>
            {listaOtras}
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="px-3 text-xs text-gray-500 truncate">{session?.user?.email || ''}</p>
              <button onClick={handleSignOut} className="mt-1 w-full text-left min-h-[44px] px-3 rounded-lg text-sm font-semibold text-red-700 hover:bg-red-50">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette
        items={[
          ...tienda.map((it) => ({ label: it.label, href: it.href, group: 'Tienda' })),
          ...otras.map((it) => ({
            label: it.label,
            href: adminHref(it, 'barraca', { constructora: constructoraUrl }),
            group: it.group,
            keywords: it.keywords,
          })),
        ]}
      />
    </div>
  );
}
