"use client"

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { can, visibleModules } from '@jurmaq/shared/roles';
import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  adminHref,
  esExterno,
  type AdminNavGroup,
  type AdminNavItem,
} from '@jurmaq/shared/admin/nav';
import CommandPalette from '@jurmaq/shared/ui/CommandPalette';
import { env } from '@jurmaq/shared/env';
import NotificationsBell from './NotificationsBell';

/**
 * AdminShell — panel admin de Barraca (e-commerce de fierros y materiales).
 *
 * Antes esto vivía dentro del shell de constructora con detección por path
 * (`/admin/barraca/*`), pero post-split barraca tiene su propio dominio
 * (barraca.jurmaq.cl) con su propio admin (`barraca.jurmaq.cl/admin/*`).
 * Cada app tiene su layout admin independiente para que el branding,
 * navegación, y sesión queden aislados.
 *
 * SEO: este shell solo se monta bajo /admin/*, que `robots.txt` ya
 * bloquea explícitamente. No hay impacto en las páginas públicas
 * (catálogo, producto, búsqueda, calculadoras, landings).
 */
/**
 * Íconos por ruta. El menú vive en `@jurmaq/shared/admin/nav`, compartido con
 * el panel de jurmaq.cl para que ambos pinten la misma lista completa.
 */
const ICONOS: Record<string, React.ReactNode> = {
  '/admin': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  ),
  '/admin/cotizaciones': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
    </svg>
  ),
  '/admin/productos': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  '/admin/categorias': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  '/admin/precios': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  '/admin/promociones': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
  '/admin/cupones': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
    </svg>
  ),
  '/admin/imagenes': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  '/admin/importar': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  '/admin/reviews': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  '/admin/suscriptores': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

const ICONO_DEFAULT = (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/cuenta/login');
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  // Si el sysadmin tiene acceso al admin de constructora, ofrecemos un link
  // de cross-admin (configurable via env). En dev queda apuntando al puerto
  // de constructora; en prod a admin.jurmaq.cl o jurmaq.cl según deploy.
  const constructoraUrl = env.NEXT_PUBLIC_CONSTRUCTORA_URL || '';

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#0c1d3a' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#ea580c' }}
            >
              <span className="text-lg font-black text-white">B</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">JURMAQ</h1>
              <p className="text-gray-500 text-xs">Panel Barraca</p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-gray-500 hover:text-white"
              aria-label="Cerrar menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nav ÚNICO: la lista completa de las dos unidades, desde
              @jurmaq/shared/admin/nav — la misma que pinta jurmaq.cl/admin. Los
              ítems de arriendo/contratos/tributario abren jurmaq.cl; la sesión
              viaja porque la cookie es Domain=.jurmaq.cl. */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {(() => {
              const role = (session?.user as { role?: string })?.role;
              // Por ACCIÓN, no solo por módulo: así no se ofrecen pantallas que
              // van a devolver 403.
              const filtered = ADMIN_NAV.filter((it) => can(role, it.module, it.action ?? 'read'));
              const accentBg = '#ea580c';
              const accentFg = '#fff';

              const grouped = new Map<AdminNavGroup, AdminNavItem[]>();
              for (const it of filtered) {
                if (!grouped.has(it.group)) grouped.set(it.group, []);
                grouped.get(it.group)!.push(it);
              }

              return ADMIN_NAV_GROUPS.filter((g) => grouped.has(g)).map((group, idx) => (
                <div key={group} className={idx > 0 ? 'mt-4' : ''}>
                  <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {group}
                  </div>
                  <div className="space-y-0.5">
                    {grouped.get(group)!.map((item) => {
                      const externo = esExterno(item, 'barraca');
                      const href = adminHref(item, 'barraca', { constructora: constructoraUrl || undefined });
                      const active = !externo && isActive(item.path);
                      return (
                        <Link
                          key={`${item.app}${item.path}`}
                          href={href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            active ? 'text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'
                          }`}
                          style={active ? { backgroundColor: accentBg, color: accentFg } : {}}
                        >
                          {ICONOS[item.path] ?? ICONO_DEFAULT}
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </nav>

          {/* El link cruzado al otro panel se eliminó: el sidebar ya lista
              TODAS las secciones de las dos unidades. */}

          {/* Sign out */}
          <div className="px-3 py-4 border-t border-white/10">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-colors w-full"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden lg:flex items-center gap-3">
            <span
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
              style={{ backgroundColor: '#fff7ed', color: '#9a3412' }}
            >
              Barraca
            </span>
            <h2 className="text-lg font-semibold text-gray-800">
              {ADMIN_NAV.find((item) => item.app === 'barraca' && isActive(item.path))?.label || 'Admin'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <NotificationsBell />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-700">
                {session?.user?.name || 'Administrador'}
              </p>
              <p className="text-xs text-gray-500">{session?.user?.email || ''}</p>
            </div>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: '#0c1d3a' }}
            >
              {(session?.user?.name || 'A').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">{children}</main>
      </div>

      {/* Command Palette (Cmd+K) */}
      <CommandPalette
        items={ADMIN_NAV
          .filter((it) => can((session?.user as { role?: string })?.role, it.module, it.action ?? 'read'))
          .map((it) => ({
            label: it.label,
            href: adminHref(it, 'barraca', { constructora: constructoraUrl || undefined }),
            group: it.group,
            keywords: it.keywords,
          }))}
      />
    </div>
  );
}
