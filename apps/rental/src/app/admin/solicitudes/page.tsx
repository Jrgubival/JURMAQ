import Link from 'next/link';
import ErrorCarga from '@/components/admin/ErrorCarga';
import FilaSolicitud from '@/components/admin/FilaSolicitud';
import { exigirPermiso, solicitudesPendientes } from '@/lib/panel';

export default async function Solicitudes() {
  await exigirPermiso('cotizaciones', 'read');
  const { pendientes, error } = await solicitudesPendientes();
  return (
    <>
      <Link href="/admin" prefetch={false} className="text-[0.8125rem] text-ink-muted underline underline-offset-4">Hoy</Link>
      <h1 className="mt-1">Solicitudes de la web</h1>
      {error ? <ErrorCarga /> : pendientes.length === 0 ? <p className="mt-3 text-ink-muted">No hay solicitudes nuevas.</p> : (
        <ul className="tarjeta mt-3 divide-y divide-hairline overflow-hidden">
          {pendientes.map((s) => <FilaSolicitud key={s.id} s={s} />)}
        </ul>
      )}
    </>
  );
}
