import Link from 'next/link';
import Descartar from '@/components/admin/Descartar';
import type { SolicitudWeb } from '@/lib/panel';

function hace(fecha: string): string {
  const minutos = Math.max(1, Math.round((Date.now() - new Date(fecha).getTime()) / 60000));
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

export default function FilaSolicitud({ s }: { s: SolicitudWeb }) {
  const maquina = (s.maquinarias as { nombre?: string } | null)?.nombre;
  return (
    <li className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">{s.cliente_nombre}</p>
        <p className="shrink-0 text-[0.8125rem] text-ink-muted">{hace(s.created_at)}</p>
      </div>
      <p className="text-ink-soft">{maquina ?? 'Sin máquina'}, {s.ubicacion_servicio}{s.fecha_servicio ? `, para el ${new Date(`${s.fecha_servicio}T12:00`).toLocaleDateString('es-CL')}` : ''}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Link href={`/admin/cotizaciones/nueva?solicitud=${s.id}`} prefetch={false} className="boton boton-principal">Hacer cotización</Link>
        {s.cliente_telefono ? <a href={`tel:${s.cliente_telefono}`} className="boton boton-suave">Llamar</a> : null}
        <Descartar id={s.id} />
      </div>
    </li>
  );
}
