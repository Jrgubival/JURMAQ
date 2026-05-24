'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import type { Module } from '@jurmaq/shared/roles';
import { visibleModules } from '@jurmaq/shared/roles';
import CommandPalette from '@jurmaq/shared/ui/CommandPalette';
import GlobalSearch from './GlobalSearch';
import NotificationsBell from './NotificationsBell';

/**
 * Admin panel se separa por dominio funcional:
 *   - "construct"  → /admin (excepto /admin/barraca/*): maquinaria, contratos,
 *                    combustible, etc. Es el panel histórico de la constructora.
 *   - "barraca"    → /admin/barraca/*: e-commerce JURMAQ Barraca (productos,
 *                    promociones, importar Excel, imágenes, etc).
 *
 * Decisión: dos sidebars separados, mismo shell. El usuario alterna con un
 * switcher al pie. Antes ambos navs aparecían juntos lo cual saturaba la
 * pantalla y mezclaba responsabilidades — un vendedor de barraca no necesita
 * ver "Solicitudes de maquinaria" todo el día.
 */
type NavGroup = 'Operaciones' | 'Catálogo' | 'Tributario' | 'Configuración';

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
    label: 'Maquinarias',
    href: '/admin/maquinarias',
    module: 'maquinarias',
    group: 'Catálogo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Solicitudes',
    href: '/admin/solicitudes',
    module: 'solicitudes',
    group: 'Operaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" />
      </svg>
    ),
  },
  {
    label: 'Proyectos',
    href: '/admin/proyectos',
    module: 'proyectos',
    group: 'Operaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Clientes',
    href: '/admin/clientes',
    module: 'clientes',
    group: 'Catálogo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Cotizaciones',
    href: '/admin/cotizaciones',
    module: 'cotizaciones',
    group: 'Operaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" />
      </svg>
    ),
  },
  {
    label: 'Cotizaciones arriendo',
    href: '/admin/cotizaciones-arriendo',
    module: 'cotizaciones',
    group: 'Operaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a2 2 0 012-2h2a2 2 0 012 2v2M9 17a4 4 0 11-4-4m4 4a4 4 0 014 4M5 13a4 4 0 100-8 4 4 0 000 8z" />
      </svg>
    ),
  },
  {
    label: 'Contratos',
    href: '/admin/contratos',
    module: 'contratos',
    group: 'Operaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Plantillas contrato',
    href: '/admin/contratos/templates',
    module: 'contratos',
    group: 'Catálogo',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: 'Combustible',
    href: '/admin/combustible',
    module: 'combustible',
    group: 'Tributario',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c-3 4-5 6.5-5 9.5a5 5 0 1010 0C17 9.5 15 7 12 3z" />
      </svg>
    ),
  },
  {
    label: 'Garantías Klap',
    href: '/admin/garantias',
    module: 'contratos',
    group: 'Operaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    label: 'Rentabilidad',
    href: '/admin/reportes/rentabilidad',
    module: 'maquinarias',
    group: 'Operaciones',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'SII / Tributario',
    href: '/admin/sii',
    module: 'combustible',
    group: 'Tributario',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Usuarios',
    href: '/admin/usuarios',
    module: 'usuarios',
    group: 'Configuración',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

// NOTE: el array `barracaNavItems[]` vivía aquí porque el AdminShell
// pintaba ambos paneles según `pathname.startsWith('/admin/barraca')`.
// Post-split, Barraca tiene su propio shell en
// apps/barraca/src/components/admin/AdminShell.tsx — los items se movieron
// allí. Este shell ahora sirve EXCLUSIVAMENTE al admin de Constructora.

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  // Si el sysadmin tiene acceso al admin de barraca también, ofrecemos un
  // link de cross-admin (configurable via env). Quita la necesidad del
  // switcher que vivía dentro del shell antes.
  const barracaUrl = process.env.NEXT_PUBLIC_BARRACA_URL || '';

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
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: '#0c1d3a' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#e6b422' }}
            >
              <span className="text-lg font-black" style={{ color: '#0c1d3a' }}>J</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">JURMAQ</h1>
              <p className="text-gray-500 text-xs">Panel Constructora</p>
            </div>
            {/* Close button mobile */}
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

          {/* Nav — items de constructora filtrados por permisos del rol,
              agrupados por área funcional. */}
          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {(() => {
              const role = (session?.user as { role?: string })?.role;
              const allowedModules = new Set(visibleModules(role));
              const filtered = navItems.filter((it) => allowedModules.has(it.module));
              const accentBg = '#e6b422';
              const accentFg = '#0c1d3a';

              // Orden de grupos: Operaciones primero (lo más usado),
              // Configuración al final.
              const groupOrder: NavGroup[] = [
                'Operaciones',
                'Catálogo',
                'Tributario',
                'Configuración',
              ];

              // Agrupar items por group field, preservando el orden de items
              // dentro de cada grupo.
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

          {/* Cross-admin link (a barraca admin, opcional). Aparece solo si
              NEXT_PUBLIC_BARRACA_URL está configurada Y el usuario tiene
              permiso en al menos un módulo de barraca (rol con scope
              barraca/both). */}
          {barracaUrl && (() => {
            const role = (session?.user as { role?: string })?.role;
            const allowedModules = new Set(visibleModules(role));
            const hasBarracaAccess = Array.from(allowedModules).some((m) =>
              String(m).startsWith('barraca_')
            );
            if (!hasBarracaAccess) return null;
            return (
              <div className="px-3 pb-2 border-t border-white/10 pt-3">
                <a
                  href={`${barracaUrl}/admin`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <span aria-hidden="true">→</span>
                  Panel Barraca
                </a>
              </div>
            );
          })()}

          {/* Sign out */}
          <div className="px-3 py-4 border-t border-white/10">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-colors w-full"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar Sesion
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="hidden lg:flex items-center gap-3 flex-1">
            <span
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
              style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
            >
              Constructora
            </span>
            <h2 className="text-lg font-semibold text-gray-800 whitespace-nowrap">
              {navItems.find((item) => isActive(item.href))?.label || 'Admin'}
            </h2>
            {/* F2-UI: búsqueda global cross-modulo. Cmd+K abre desde cualquier lado. */}
            <div className="ml-6 flex-1 max-w-md">
              <GlobalSearch />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationsBell />
            <div className="text-right">
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

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">{children}</main>
      </div>

      {/* Command Palette (Cmd+K) — navegación rápida por todas las secciones admin */}
      <CommandPalette
        items={[
          // Operaciones
          { label: 'Dashboard', href: '/admin', group: 'Operaciones' },
          { label: 'Cotizaciones arriendo', href: '/admin/cotizaciones-arriendo', group: 'Operaciones', keywords: ['cotizar', 'arriendo', 'cot-ar'] },
          { label: 'Cotizaciones (legacy)', href: '/admin/cotizaciones', group: 'Operaciones' },
          { label: 'Contratos', href: '/admin/contratos', group: 'Operaciones', keywords: ['firma', 'contrato'] },
          { label: 'Solicitudes', href: '/admin/solicitudes', group: 'Operaciones' },
          { label: 'Proyectos', href: '/admin/proyectos', group: 'Operaciones' },
          // Catálogo
          { label: 'Maquinarias', href: '/admin/maquinarias', group: 'Catálogo' },
          { label: 'Clientes', href: '/admin/clientes', group: 'Catálogo' },
          { label: 'Plantillas contrato', href: '/admin/contratos/templates', group: 'Catálogo' },
          // Tributario
          { label: 'SII / F29', href: '/admin/sii', group: 'Tributario', keywords: ['iva', 'tributario', 'export'] },
          { label: 'Combustible', href: '/admin/combustible', group: 'Tributario', keywords: ['iec', 'f29'] },
          { label: 'Tarifas IEC', href: '/admin/combustible/tarifas', group: 'Tributario' },
          // Configuración
          { label: 'Usuarios', href: '/admin/usuarios', group: 'Configuración' },
          { label: 'Email queue', href: '/admin/email-queue', group: 'Configuración' },
        ]}
      />
    </div>
  );
}
