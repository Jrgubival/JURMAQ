import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getClienteFromRequest } from '@/lib/cuenta-auth';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { formatCLP } from '@jurmaq/shared/format';

export const dynamic = 'force-dynamic';

const estadoColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  renewed: 'bg-blue-100 text-blue-700',
  captured: 'bg-purple-100 text-purple-700',
  partial_captured: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-gray-100 text-gray-700',
  expired: 'bg-red-100 text-red-700',
  renewal_failed: 'bg-red-100 text-red-700',
};

const estadoLabel: Record<string, string> = {
  active: 'Activa',
  renewed: 'Renovada',
  captured: 'Capturada',
  partial_captured: 'Captura parcial',
  cancelled: 'Liberada',
  expired: 'Vencida',
  renewal_failed: 'Renovación falló',
  renewal_failed_terminal: 'Renovación falló (acción requerida)',
};

export default async function GarantiasPage() {
  const cliente = await getClienteFromRequest();
  if (!cliente) redirect('/cuenta/login');

  // Holds del cliente vía sus contratos.
  const { data: contratos } = await supabaseAdmin
    .from('contratos')
    .select('id, numero')
    .ilike('arrendatario_email', cliente.email);

  const contratoIds = (contratos ?? []).map((c) => c.id);
  let holds: Array<Record<string, unknown>> = [];
  if (contratoIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('klap_holds')
      .select(
        'id, contrato_id, monto, estado, autorizado_at, expira_at, renovaciones_count, capturado_monto, cancelado_at',
      )
      .in('contrato_id', contratoIds)
      .order('autorizado_at', { ascending: false });
    holds = data ?? [];
  }

  const contratoNumeroMap = new Map<number, string>();
  (contratos ?? []).forEach((c) => contratoNumeroMap.set(c.id as number, String(c.numero ?? '')));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mis garantías</h1>
        <p className="text-sm text-gray-500 mt-1">Holds de garantía en tu(s) tarjeta(s) JURMAQ.</p>
      </div>

      {holds.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">
          No tienes garantías activas. Cuando arriendes una máquina y autorices el hold,
          aparecerá acá.
        </div>
      ) : (
        <div className="space-y-3">
          {holds.map((h) => {
            const numero = contratoNumeroMap.get(h.contrato_id as number) || `#${h.contrato_id}`;
            const estado = h.estado as string;
            const expiraAt = h.expira_at ? new Date(String(h.expira_at)) : null;
            const renovacionEnDias =
              expiraAt && estado === 'active'
                ? Math.ceil((expiraAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                : null;
            const renovacionAlerta = renovacionEnDias !== null && renovacionEnDias <= 3 && renovacionEnDias >= 0;
            const renovacionFalla = estado === 'renewal_failed' || estado === 'renewal_failed_terminal';

            return (
              <div
                key={String(h.id)}
                className={`bg-white border rounded-2xl p-5 ${
                  renovacionFalla
                    ? 'border-red-300'
                    : renovacionAlerta
                      ? 'border-amber-300'
                      : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <Link
                      href={`/cuenta/contratos/${encodeURIComponent(numero)}`}
                      className="text-base font-semibold text-gray-900 hover:underline"
                    >
                      Contrato {numero}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Autorizada: {h.autorizado_at ? new Date(String(h.autorizado_at)).toLocaleDateString('es-CL') : '—'}
                    </div>
                  </div>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      estadoColor[estado] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {estadoLabel[estado] || estado}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase text-gray-500">Monto</div>
                    <div className="font-medium tabular-nums">{formatCLP(Number(h.monto) || 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Renovaciones</div>
                    <div className="font-medium">{String(h.renovaciones_count ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Vence</div>
                    <div className="font-medium text-xs">
                      {expiraAt ? expiraAt.toLocaleDateString('es-CL') : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-500">Capturado</div>
                    <div className="font-medium tabular-nums">{formatCLP(Number(h.capturado_monto) || 0)}</div>
                  </div>
                </div>

                {renovacionAlerta && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs">
                    Tu garantía vence en {renovacionEnDias} día{renovacionEnDias === 1 ? '' : 's'}. Vamos a
                    renovarla automáticamente — sin acción requerida.
                  </div>
                )}
                {renovacionFalla && (
                  <div className="mt-3 bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs">
                    No pudimos renovar tu garantía. Por favor{' '}
                    <Link href="/cuenta/tarjetas" className="underline font-medium">
                      actualiza tu tarjeta
                    </Link>
                    .
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
