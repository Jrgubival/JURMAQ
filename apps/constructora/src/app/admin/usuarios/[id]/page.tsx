/**
 * /admin/usuarios/[id]
 *
 * Detalle de usuario / operario. Hoy contiene el módulo Documentos
 * (subir / listar / descargar / eliminar licencias, contratos, capacitaciones).
 * El resto de la gestión del usuario sigue en el modal del listing.
 */
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import DocumentosClient from './DocumentosClient';

export const dynamic = 'force-dynamic';

const roleBadge: Record<string, { bg: string; text: string; label: string }> = {
  admin: { bg: 'bg-red-100', text: 'text-red-700', label: 'Admin' },
  gerente: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Gerente' },
  vendedor: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Vendedor' },
  operador: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Operador' },
  contador: { bg: 'bg-green-100', text: 'text-green-700', label: 'Contador' },
};

export default async function UsuarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId) || numericId <= 0) notFound();

  const { data: usuario, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, created_at')
    .eq('id', numericId)
    .maybeSingle();

  if (error || !usuario) notFound();

  const u = usuario as { id: number; name: string; email: string; role: string; created_at: string };
  const badge = roleBadge[u.role] || { bg: 'bg-gray-100', text: 'text-gray-700', label: u.role };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 lg:px-0">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/admin/usuarios" className="hover:text-gray-900 transition-colors">
          ← Usuarios
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-900 font-medium">{u.name}</span>
      </nav>

      <header className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-navy-950 flex items-center justify-center text-white text-2xl font-bold">
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-navy-950">{u.name}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            </div>
            <p className="text-sm text-gray-600">{u.email}</p>
            <p className="text-xs text-gray-500 mt-1">ID #{u.id}</p>
          </div>
        </div>
      </header>

      <DocumentosClient userId={u.id} userName={u.name} />
    </div>
  );
}
