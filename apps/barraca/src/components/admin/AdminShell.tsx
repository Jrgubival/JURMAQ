'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import type { Module } from '@jurmaq/shared/roles';
import { visibleModules } from '@jurmaq/shared/roles';
import CommandPalette from '@jurmaq/shared/ui/CommandPalette';
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
type NavGroup = 'Operaciones' | 'Catálogo' | 'Ventas' | 'Marketing' | 'Referidos' | 'Clientes';

interface NavItem {
  label: string;
  href: string;
  module: Module;
  group: NavGroup;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    module: 'dashboard',
    group: 'Operaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
      </svg>
    ),
  },
  {
    label: 'Productos',
    href: '/admin/productos',
    module: 'barraca_productos',
    group: 'Catálogo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Categorías',
    href: '/admin/categorias',
    module: 'barraca_categorias',
    group: 'Catálogo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    label: 'Importar',
    href: '/admin/importar',
    module: 'barraca_importar',
    group: 'Catálogo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    label: 'Imágenes',
    href: '/admin/imagenes',
    module: 'barraca_imagenes',
    group: 'Catálogo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Imágenes masivas',
    href: '/admin/imagenes-masivas',
    module: 'barraca_imagenes',
    group: 'Catálogo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Cotizaciones',
    href: '/admin/cotizaciones',
    module: 'barraca_cotizaciones',
    group: 'Ventas',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Precios',
    href: '/admin/precios',
    module: 'barraca_precios',
    group: 'Ventas',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Promociones',
    href: '/admin/promociones',
    module: 'barraca_promociones',
    group: 'Marketing',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
  },
  {
    label: 'Cupones',
    href: '/admin/cupones',
    module: 'barraca_promociones',
    group: 'Marketing',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    label: 'Suscriptores',
    href: '/admin/suscriptores',
    module: 'barraca_suscriptores',
    group: 'Marketing',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Reviews',
    href: '/admin/reviews',
    module: 'barraca_reviews',
    group: 'Marketing',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  {
    label: 'Clientes 360',
    href: '/admin/clientes',
    module: 'barraca_clientes',
    group: 'Clientes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    label: 'Maestros',
    href: '/admin/maestros',
    module: 'barraca_maestros',
    group: 'Referidos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'Comisiones',
    href: '/admin/comisiones',
    module: 'barraca_comisiones',
    group: 'Referidos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

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
  const constructoraUrl = process.env.NEXT_PUBLIC_CONSTRUCTORA_URL || '';

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

          {/* Nav agrupado */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {(() => {
              const role = (session?.user as { role?: string })?.role;
              const allowedModules = new Set(visibleModules(role));
              const filtered = navItems.filter((it) => allowedModules.has(it.module));
              const accentBg = '#ea580c';
              const accentFg = '#fff';

              const groupOrder: NavGroup[] = ['Operaciones', 'Catálogo', 'Ventas', 'Marketing'];
              const grouped = new Map<NavGroup, NavItem[]>();
              for (const it of filtered) {
                if (!grouped.has(it.group)) grouped.set(it.group, []);
                grouped.get(it.group)!.push(it);
              }

              return groupOrder
                .filter((g) => grouped.has(g))
                .map((group, idx) => (
                  <div key={group} className={idx > 0 ? 'mt-4' : ''}>
                    <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      {group}
                    </div>
                    <div className="space-y-0.5">
                      {grouped.get(group)!.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                              active
                                ? 'text-white'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                            style={active ? { backgroundColor: accentBg, color: accentFg } : {}}
                          >
                            {item.icon}
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ));
            })()}
          </nav>

          {/* Cross-admin link (solo si hay env var configurada) */}
          {constructoraUrl && (
            <div className="px-3 pb-2 border-t border-white/10 pt-3">
              <a
                href={`${constructoraUrl}/admin`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
              >
                <span aria-hidden="true">→</span>
                Panel Constructora
              </a>
            </div>
          )}

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
              {navItems.find((item) => isActive(item.href))?.label || 'Admin'}
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
        items={[
          { label: 'Dashboard', href: '/admin', group: 'Operaciones' },
          { label: 'Productos', href: '/admin/productos', group: 'Catálogo' },
          { label: 'Categorías', href: '/admin/categorias', group: 'Catálogo' },
          { label: 'Imágenes', href: '/admin/imagenes', group: 'Catálogo' },
          { label: 'Imágenes masivas', href: '/admin/imagenes-masivas', group: 'Catálogo' },
          { label: 'Importar', href: '/admin/importar', group: 'Catálogo' },
          { label: 'Cotizaciones', href: '/admin/cotizaciones', group: 'Ventas', keywords: ['cot', 'cotizar'] },
          { label: 'Precios', href: '/admin/precios', group: 'Ventas' },
          { label: 'Promociones', href: '/admin/promociones', group: 'Marketing' },
          { label: 'Suscriptores', href: '/admin/suscriptores', group: 'Marketing' },
        ]}
      />
    </div>
  );
}
