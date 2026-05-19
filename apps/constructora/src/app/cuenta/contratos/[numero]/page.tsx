import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { formatCLP } from '@jurmaq/shared/format';

export const dynamic = 'force-dynamic';

export default async function ContratoDetailPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const cliente = await getClienteFromRequest();
  if (!cliente) redirect('/cuenta/login');

  const { numero } = await params;
  const numeroNorm = decodeURIComponent(numero);

  const { data: contrato } = await supabaseAdmin
    .from('contratos')
    .select('*')
    .eq('numero', numeroNorm)
    .ilike('arrendatario_email', cliente.email)
    .maybeSingle();

  if (!contrato) notFound();

  let maquinariaNombre = '—';
  if (contrato.maquinaria_id) {
    const { data: m } = await supabaseAdmin
      .from('maquinarias')
      .select('nombre, tipo')
      .eq('id', contrato.maquinaria_id)
      .maybeSingle();
    if (m) maquinariaNombre = `${m.nombre}${m.tipo ? ` (${m.tipo})` : ''}`;
  }

  return (
    <div className="space-y-4">
      <Link href="/cuenta/contratos" className="text-sm text-gray-500 hover:text-gray-700">
        ← Volver a mis contratos
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contrato {contrato.numero || `#${contrato.id}`}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Estado: <span className="font-semibold">{contrato.estado}</span>
          </p>
        </div>
        {(contrato.estado === 'firmado' || contrato.estado === 'vigente' || contrato.estado === 'pendiente_firma') && (
          <a
            href={`/api/cuenta/contratos/${contrato.id}/pdf`}
            target="_blank"
            rel="noopener"
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-xl"
          >
            {contrato.estado === 'pendiente_firma' ? 'Firmar contrato →' : 'Ver / Descargar PDF →'}
          </a>
        )}
      </div>

      {/* Datos contrato */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Maquinaria" value={maquinariaNombre} />
        <Field
          label="Vigencia"
          value={`${
            contrato.fecha_inicio ? new Date(String(contrato.fecha_inicio)).toLocaleDateString('es-CL') : '—'
          } → ${
            contrato.fecha_termino ? new Date(String(contrato.fecha_termino)).toLocaleDateString('es-CL') : '—'
          }`}
        />
        <Field label="Precio total" value={formatCLP(Number(contrato.precio_total) || 0)} />
        <Field label="Unidad de precio" value={String(contrato.precio_unidad || '—')} />
        <Field
          label="Firmado"
          value={
            contrato.firma_timestamp
              ? new Date(String(contrato.firma_timestamp)).toLocaleString('es-CL')
              : 'Aún no firmado'
          }
        />
        <Field
          label="Garantía"
          value={`${formatCLP(Number(contrato.garantia_monto) || 0)} · ${
            contrato.garantia_metodo || 'pendiente'
          }`}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Información de firma</h2>
        <p className="text-sm text-gray-700">
          {contrato.estado === 'firmado' || contrato.estado === 'vigente'
            ? `Tu contrato fue firmado el ${new Date(String(contrato.firma_timestamp)).toLocaleString('es-CL')}. Puedes descargar el PDF cuando lo necesites.`
            : contrato.estado === 'pendiente_firma'
              ? 'Tu contrato está pendiente de firma. Haz clic en "Firmar contrato" para completar el proceso.'
              : 'Este contrato aún no está en estado firmable. El equipo JURMAQ se contactará contigo.'}
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div className="font-medium text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}
