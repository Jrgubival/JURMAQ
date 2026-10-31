"use client"

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { can, type Module, type Action } from '@jurmaq/shared/roles';
import { ADMIN_NAV, adminHref, esExterno } from '@jurmaq/shared/admin/nav';
import CommandPalette from '@jurmaq/shared/ui/CommandPalette';
import { env } from '@jurmaq/shared/env';
import NotificationsBell from './NotificationsBell';

/**
 * AdminShell — panel de la tienda en línea (barraca.jurmaq.cl/admin).
 *
 * Pensado para atender ventas desde el celular en el mesón: barra superior
 * azul marino con la marca, y en el teléfono una barra inferior con las
 * secciones (sólo si hay más de una: el vendedor ve sólo Ventas). En el
 * computador, barra lateral.
 *
 * La visibilidad es sólo comodidad: cada página y cada /api/admin/* valida el
 * permiso en el servidor (el vendedor recibe 403 en Productos y Despacho).
 */

interface ItemTienda {
  label: string;
  href: string;
  module: Module;
  action?: Action;
  /** Otras rutas que marcan esta sección como activa. */
  tambien?: string[];
  icon: React.ReactNode;
}

const ic = (d: string) => (
  <svg className="w-[22px] h-[22px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
  </svg>
);

const TIENDA: ItemTienda[] = [
  { label: 'Ventas', href: '/admin', module: 'barraca_ventas', tambien: ['/admin/ventas', '/admin/pedidos'], icon: ic('M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z') },
  { label: 'Productos', href: '/admin/productos', module: 'barraca_productos', icon: ic('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4') },
  { label: 'Despacho', href: '/admin/despacho', module: 'barraca_precios', icon: ic('M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1') },
];

/** Rutas propias de la tienda (no se repiten en "Más herramientas"). */
const RUTAS_TIENDA = new Set(['/admin', '/admin/pedidos', '/admin/productos', '/admin/despacho', '/admin/dashboard']);

function Marca({ chica = false }: { chica?: boolean }) {
  return (
    <span className="flex flex-col leading-none">
      <span className={`cifra font-bold tracking-[0.06em] text-white ${chica ? 'text-[19px]' : 'text-[22px]'}`}>JURMAQ</span>
      <span aria-hidden="true" className="mt-1 h-[3px] w-full bg-marca-600" />
      <span className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-white/65">Barraca · Panel</span>
    </span>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [masAbierto, setMasAbierto] = useState(false);
  const pathname = usePathname() || '';
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const constructoraUrl = env.NEXT_PUBLIC_CONSTRUCTORA_URL || undefined;

  // Siempre a /login (código por correo). Recarga completa: no queda nada del panel en memoria.
  const salir = async () => {
    await signOut({ redirect: false }).catch(() => {});
    window.location.assign('/login');
  };

  const activo = (it: ItemTienda) =>
    it.href === '/admin'
      ? pathname === '/admin' || (it.tambien ?? []).some((r) => pathname.startsWith(r))
      : pathname.startsWith(it.href);

  // Sin sesión todavía (cargando) no se muestra nada que el rol no pueda ver.
  const tienda = TIENDA.filter((it) => !!session && can(role, it.module, it.action ?? 'read'));
  const otras = ADMIN_NAV.filter(
    (it) => can(role, it.module, it.action ?? 'read') && !(it.app === 'barraca' && RUTAS_TIENDA.has(it.path)),
  );
  const conBarraInferior = tienda.length > 1;

  const listaOtras = (
    <ul className="space-y-0.5">
      {otras.map((item) => {
        const externo = esExterno(item, 'barraca');
        const href = adminHref(item, 'barraca', { constructora: constructoraUrl });
        return (
          <li key={`${item.app}${item.path}`}>
            <Link
              href={href}
              onClick={() => setMasAbierto(false)}
              className="flex items-center justify-between min-h-[44px] px-3 rounded-lg text-[14px] hover:bg-black/5"
            >
              <span>{item.label}</span>
              {externo && <span className="text-[11px] opacity-60">jurmaq.cl ↗</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="panel-ventas min-h-screen bg-[#FBFBFA] text-[#111111] lg:flex">
      {/* Barra lateral (computador) */}
      <aside className="sobre-navy hidden lg:flex lg:flex-col lg:w-[232px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-navy-950 text-white">
        <div className="px-6 pt-7 pb-6">
          <Link href="/admin" aria-label="Ventas" className="inline-block">
            <Marca />
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-3" aria-label="Secciones del panel">
          <ul className="space-y-0.5">
            {tienda.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={activo(it) ? 'page' : undefined}
                  className={`flex items-center gap-3 min-h-[44px] px-3 rounded-lg text-[14.5px] font-medium transition-colors ${
                    activo(it) ? 'bg-white/[0.09] text-white' : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  {it.icon}
                  <span className="flex-1">{it.label}</span>
                  {activo(it) && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-marca-600" />}
                </Link>
              </li>
            ))}
          </ul>
          {otras.length > 0 && (
            <details className="mt-6 pt-4 border-t border-white/10 group text-white/80">
              <summary className="cursor-pointer list-none flex items-center justify-between min-h-[44px] px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-white/55 hover:text-white/80">
                Más herramientas
                <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="mt-1 [&_a:hover]:bg-white/[0.06]">{listaOtras}</div>
            </details>
          )}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <p className="px-3 text-[12px] text-white/55 truncate">{session?.user?.email || ''}</p>
          <button onClick={salir} className="mt-1 w-full text-left min-h-[44px] px-3 rounded-lg text-[14px] font-medium text-white/80 hover:text-white hover:bg-white/[0.06]">
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Barra superior (celular) */}
        <header className="sobre-navy lg:hidden sticky top-0 z-30 bg-navy-950 text-white h-14 pl-4 pr-1 flex items-center justify-between gap-2 pt-[env(safe-area-inset-top)] box-content">
          <Link href="/admin" aria-label="Ventas" className="min-h-[44px] flex items-center">
            <Marca chica />
          </Link>
          <div className="flex items-center">
            <NotificationsBell />
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/10"
              aria-label="Menú: más herramientas y cerrar sesión"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </header>

        {/* Campana en el computador: arriba a la derecha, sin barra extra. */}
        <div className="hidden lg:flex justify-end items-center h-14 px-8 relative z-20 text-navy-950 [&_button:hover]:bg-black/5">
          <NotificationsBell />
        </div>

        <main className={`flex-1 w-full max-w-[1180px] mx-auto px-4 pt-4 lg:px-10 lg:pt-0 ${conBarraInferior ? 'pb-28' : 'pb-10'} lg:pb-12`}>
          {children}
        </main>
      </div>

      {/* Barra inferior (celular), sólo si hay más de una sección */}
      {conBarraInferior && (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-[#E6E4DF] pb-[env(safe-area-inset-bottom)]"
          aria-label="Secciones del panel"
        >
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${tienda.length}, minmax(0, 1fr))` }}>
            {tienda.map((it) => (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={activo(it) ? 'page' : undefined}
                  className={`relative flex flex-col items-center justify-center gap-1 min-h-[58px] text-[11.5px] font-semibold ${
                    activo(it) ? 'text-navy-950' : 'text-[#6B6A66]'
                  }`}
                >
                  {activo(it) && <span aria-hidden="true" className="absolute top-0 inset-x-6 h-[3px] rounded-b bg-marca-600" />}
                  {it.icon}
                  {it.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Hoja "Menú" (celular) */}
      {masAbierto && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menú">
          <button className="absolute inset-0 bg-navy-950/50" aria-label="Cerrar menú" onClick={() => setMasAbierto(false)} />
          <div className="absolute bottom-0 inset-x-0 max-h-[85vh] overflow-y-auto bg-white rounded-t-2xl px-3 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between pl-3">
              <p className="text-[15px] font-semibold text-navy-950">Menú</p>
              <button onClick={() => setMasAbierto(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#6B6A66]" aria-label="Cerrar menú">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
            {tienda.length > 0 && (
              <ul className="mb-2 pb-2 border-b border-[#EFEDE8]">
                {tienda.map((it) => (
                  <li key={it.href}>
                    <Link href={it.href} onClick={() => setMasAbierto(false)} className="flex items-center gap-3 min-h-[48px] px-3 rounded-lg text-[15px] font-medium text-navy-950 hover:bg-black/5">
                      {it.icon}
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {otras.length > 0 && (
              <>
                <p className="px-3 pt-1 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#8A8884]">Más herramientas</p>
                <div className="text-[#2B2A28]">{listaOtras}</div>
              </>
            )}
            <div className="mt-2 pt-2 border-t border-[#EFEDE8]">
              <p className="px-3 py-1 text-[12.5px] text-[#6B6A66] truncate">{session?.user?.email || ''}</p>
              <button onClick={salir} className="w-full text-left min-h-[48px] px-3 rounded-lg text-[15px] font-semibold text-marca-700 hover:bg-marca-50">
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
