/**
 * /admin/maquinarias/[id]
 *
 * Página de detalle de una máquina. Hoy contiene el módulo Documentos
 * (subir / listar / descargar / eliminar) — el resto de la gestión sigue
 * en el modal del listing (/admin/maquinarias).
 *
 * Cuando se agreguen más tabs (Bloqueos calendario, Historial mantención,
 * etc.) este server-component fetcha la máquina y los datos compartidos,
 * y el client component <DocumentosClient> los renderiza.
 */
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { redirect } from 'next/navigation';
import DocumentosClient from './DocumentosClient';

export const dynamic = 'force-dynamic';

interface MaquinariaRow {
  id: number;
  nombre: string;
  tipo: string;
  estado: string;
  imagen: string | null;
}

export default async function MaquinariaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;
  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    notFound();
  }

  const { data: maquinaria, error } = await supabaseAdmin
    .from('maquinarias')
    .select('id, nombre, tipo, estado, imagen')
    .eq('id', numericId)
    .maybeSingle();

  if (error || !maquinaria) {
    notFound();
  }

  const m = maquinaria as MaquinariaRow;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 lg:px-0">
      {/* Breadcrumb + back */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link href="/admin/maquinarias" className="hover:text-gray-900 transition-colors">
          ← Maquinarias
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-gray-900 font-medium">{m.nombre}</span>
      </nav>

      {/* Header */}
      <header className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          {m.imagen ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.imagen}
              alt={m.nombre}
              className="w-24 h-24 object-cover rounded-xl border border-gray-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-navy-950">{m.nombre}</h1>
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gray-100 text-gray-700">
                {m.tipo}
              </span>
              <EstadoBadge estado={m.estado} />
            </div>
            <p className="text-sm text-gray-500">ID #{m.id}</p>
            <Link
              href={`/admin/maquinarias?edit=${m.id}`}
              className="inline-flex items-center gap-1 mt-3 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
            >
              Editar datos generales →
            </Link>
          </div>
        </div>
      </header>

      {/* Documentos */}
      <DocumentosClient maquinariaId={m.id} maquinariaNombre={m.nombre} />
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    disponible: { bg: 'bg-green-100', text: 'text-green-700', label: 'Disponible' },
    arrendada: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Arrendada' },
    mantencion: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En mantención' },
  };
  const c = colors[estado] || { bg: 'bg-gray-100', text: 'text-gray-700', label: estado };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}
