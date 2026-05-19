import type { Metadata } from 'next';
import Link from 'next/link';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import LogoutButton from './LogoutButton';

export const metadata: Metadata = {
  title: 'Mi cuenta — JURMAQ',
  description: 'Portal de clientes JURMAQ: cotizaciones, contratos, garantías y perfil.',
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: 'https://jurmaq.cl/cuenta' },
};

const navItems = [
  { href: '/cuenta', label: 'Resumen', icon: '🏠' },
  { href: '/cuenta/cotizaciones', label: 'Cotizaciones', icon: '📋' },
  { href: '/cuenta/contratos', label: 'Contratos', icon: '📑' },
  { href: '/cuenta/perfil', label: 'Mi perfil', icon: '👤' },
];

export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const cliente = await getClienteFromRequest();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-navy-950 border-b border-navy-900">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/cuenta" className="text-white font-bold text-lg">
            <span style={{ color: '#e6b422' }}>JURMAQ</span> · Mi cuenta
          </Link>
          {cliente && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-300 hidden sm:inline">
                {cliente.nombre || cliente.email}
              </span>
              <Link
                href="/"
                className="text-sm text-gray-300 hover:text-white px-3 py-1.5"
              >
                Volver al sitio
              </Link>
              <LogoutButton />
            </div>
          )}
        </div>
      </header>

      {cliente ? (
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
          {/* Sidebar nav */}
          <nav className="bg-white border border-gray-200 rounded-xl p-3 h-fit md:sticky md:top-6">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition"
                  >
                    <span aria-hidden>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <main>{children}</main>
        </div>
      ) : (
        // Si no hay sesión, no muestra sidebar — la página de login se renderiza
        // como hijo directo.
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      )}
    </div>
  );
}
