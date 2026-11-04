'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ESTADOS_COTIZACION } from '@/lib/opciones';
import type { CotizacionPdf } from '@/lib/pdf-cotizacion';

export default function AccionesCotizacion({
  id,
  numero,
  estado,
  cliente,
  pdf,
}: {
  id: number;
  numero: string;
  estado: string;
  cliente: string;
  pdf: CotizacionPdf;
}) {
  const router = useRouter();
  // Con contrato la cotización ya no se edita (ver la API).
  const editable = (ESTADOS_COTIZACION as readonly string[]).includes(estado);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const nombreArchivo = `Cotizacion ${numero} ${cliente}`.replace(/[^\p{L}\p{N} .-]/gu, '').slice(0, 80) + '.pdf';

  async function archivo(): Promise<File> {
    const { generarPdf } = await import('@/lib/pdf-cotizacion');
    const bytes = await generarPdf(pdf);
    return new File([bytes.slice().buffer as ArrayBuffer], nombreArchivo, { type: 'application/pdf' });
  }

  function descargar(f: File) {
    const url = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function marcar(nuevo: string) {
    const r = await fetch(`/api/admin/cotizaciones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: nuevo }),
    });
    if (!r.ok) throw new Error('estado');
    router.refresh();
  }

  async function correr(accion: () => Promise<void>) {
    setError('');
    setOcupado(true);
    try {
      await accion();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError('No se pudo completar. Intenta de nuevo.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" className="boton boton-principal flex-1 sm:flex-none" disabled={ocupado} onClick={() => correr(async () => descargar(await archivo()))}>Descargar PDF</button>
      {editable ? <Link href={`/admin/cotizaciones/${id}/editar`} prefetch={false} className="boton boton-suave">Editar</Link> : null}
      <label className="ml-auto flex items-center gap-2 text-[0.8125rem] text-ink-muted">
        Estado
        <select aria-label="Estado de la cotización" className="campo !min-h-9 !w-auto" value={estado} disabled={ocupado} onChange={(e) => correr(async () => { await marcar(e.target.value); })}>
          {ESTADOS_COTIZACION.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
          {!(ESTADOS_COTIZACION as readonly string[]).includes(estado) ? <option value={estado}>{estado}</option> : null}
        </select>
      </label>
      {error ? <p role="alert" className="w-full font-medium text-peligro">{error}</p> : null}
    </div>
  );
}
