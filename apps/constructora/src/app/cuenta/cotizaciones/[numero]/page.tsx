import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { formatCLP } from '@jurmaq/shared/format';
import CancelarCotizacionButton from './CancelarCotizacionButton';

export const dynamic = 'force-dynamic';

export default async function CotizacionDetailPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const cliente = await getClienteFromRequest();
  if (!cliente) redirect('/cuenta/login');

  const { numero } = await params;
  const numeroNorm = decodeURIComponent(numero);

  const { data: cot } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('*')
    .eq('numero', numeroNorm)
    .ilike('cliente_email', cliente.email)
    .maybeSingle();

  if (!cot) notFound();

  // Cargar nombre de maquinaria si disponible.
  let maquinariaNombre = '—';
  if (cot.maquinaria_id) {
    const { data: m } = await supabaseAdmin
      .from('maquinarias')
      .select('nombre, tipo')
      .eq('id', cot.maquinaria_id)
      .maybeSingle();
    if (m) maquinariaNombre = `${m.nombre}${m.tipo ? ` (${m.tipo})` : ''}`;
  }

  return (
    <div className="space-y-4">
      <Link href="/cuenta/cotizaciones" className="text-sm text-gray-500 hover:text-gray-700">
        ← Volver a mis cotizaciones
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cotización {cot.numero}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Creada: {cot.created_at ? new Date(String(cot.created_at)).toLocaleString('es-CL') : '—'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* C4 Fast checkout: re-cotizar 1-click con los mismos datos */}
          {cot.maquinaria_id && (
            <Link
              href={`/cotizar-arriendo?${new URLSearchParams({
                maquinariaId: String(cot.maquinaria_id),
                ubicacion: String(cot.ubicacion_servicio || ''),
                unidades: String(cot.unidades_solicitadas || 1),
                km: String(cot.distancia_km || 0),
                peajes: String(cot.peajes || 0),
                operarios: String(cot.operarios || 1),
                horasOp: String(cot.horas_operario_estimadas || 0),
                nombre: cliente.nombre,
                email: cliente.email,
                telefono: cliente.telefono ?? '',
                rut: cliente.rut ?? '',
                empresa: cliente.empresa ?? '',
              }).toString()}`}
              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-xl whitespace-nowrap"
            >
              ↻ Cotizar similar (1-click)
            </Link>
          )}
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            {cot.estado}
          </span>
        </div>
      </div>

      {/* Datos servicio */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Maquinaria" value={maquinariaNombre} />
        <Field label="Fecha servicio" value={cot.fecha_servicio ? new Date(String(cot.fecha_servicio)).toLocaleDateString('es-CL') : '—'} />
        <Field label="Ubicación" value={String(cot.ubicacion_servicio || '—')} />
        <Field label="Distancia" value={`${cot.distancia_km ?? 0} km`} />
        <Field label="Unidades" value={`${cot.unidades_solicitadas} ${cot.unidad}`} />
        <Field label="Operarios" value={String(cot.operarios ?? 0)} />
      </div>

      {/* Pricing */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Desglose</h2>
        <dl className="text-sm space-y-1.5">
          <Row label="Uso del equipo" value={formatCLP(Number(cot.precio_uso) || 0)} />
          <Row label="Traslado (combustible)" value={formatCLP(Number(cot.traslado_combustible) || 0)} />
          <Row label="Carga / descarga" value={formatCLP(Number(cot.traslado_carga) || 0)} />
          <Row label="Operario" value={formatCLP(Number(cot.traslado_operario) || 0)} />
          <Row label="Peajes" value={formatCLP(Number(cot.peajes) || 0)} />
          <hr className="my-2" />
          <Row label="Subtotal neto" value={formatCLP(Number(cot.subtotal_neto) || 0)} />
          <Row label="IVA (19%)" value={formatCLP(Number(cot.iva) || 0)} />
          <Row label="Total" value={formatCLP(Number(cot.total) || 0)} bold />
        </dl>
      </div>

      {cot.notas_cliente && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-2">Notas</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{cot.notas_cliente}</p>
        </div>
      )}

      <CancelarCotizacionButton
        cotizacionId={cot.id}
        estado={String(cot.estado)}
        fechaServicio={cot.fecha_servicio ? String(cot.fecha_servicio) : null}
      />
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={bold ? 'font-bold text-gray-900' : 'text-gray-700'}>{label}</dt>
      <dd className={`tabular-nums ${bold ? 'font-bold text-lg text-gray-900' : 'text-gray-700'}`}>
        {value}
      </dd>
    </div>
  );
}
