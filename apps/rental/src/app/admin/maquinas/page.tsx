import Link from 'next/link';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { formatCLP } from '@jurmaq/shared/format';
import { leerMaquina, textoPrecio } from '@/lib/maquinas';
import { ESTADOS_MAQUINA } from '@/lib/opciones';
import { exigirPermiso } from '@/lib/panel';

export default async function Maquinas() {
  await exigirPermiso('maquinarias', 'read');
  const { data } = await supabaseAdmin.from('maquinarias').select('*').order('id');
  const lista = (data ?? []).map((f) => leerMaquina(f as Record<string, unknown>));
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Máquinas</h1>
        <Link href="/admin/maquinas/nueva" prefetch={false} className="boton boton-principal">Agregar</Link>
      </div>
      <ul className="mt-4 space-y-2">
        {lista.map((m) => (
          <li key={m.id}>
            <Link href={`/admin/maquinas/${m.id}`} prefetch={false} className="presionable flex items-center gap-3 rounded-xl border border-hairline bg-surface p-3">
              {m.fotos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.fotos[0]} alt="" width={80} height={60} className="h-15 w-20 rounded object-cover" />
              ) : <span className="h-15 w-20 rounded bg-surface-alt" />}
              <span className="min-w-0">
                <span className="block font-semibold">{m.nombre}</span>
                <span className="block text-sm text-ink-muted">
                  {m.precios[0] ? textoPrecio(m.precios[0], formatCLP) : 'Cotizar'} · {ESTADOS_MAQUINA.find((e) => e.valor === m.estado)?.texto ?? m.estado}
                  {m.publicada ? '' : ' · Oculta'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
