'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ESTADOS_COTIZACION } from '@/lib/esquemas';
import type { CotizacionPdf } from '@/lib/pdf-cotizacion';

export default function AccionesCotizacion({
  id,
  numero,
  estado,
  cliente,
  correo,
  telefono,
  pdf,
}: {
  id: number;
  numero: string;
  estado: string;
  cliente: string;
  correo: string | null;
  telefono: string | null;
  pdf: CotizacionPdf;
}) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const nombreArchivo = `Cotizacion ${numero} ${cliente}`.replace(/[^\p{L}\p{N} .-]/gu, '').slice(0, 80) + '.pdf';
  const mensaje = `Hola, te envío la cotización N.º ${numero} de JURMAQ.`;

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

  const compartir = () => correr(async () => {
    const f = await archivo();
    if (navigator.canShare?.({ files: [f] })) {
      await navigator.share({ files: [f], title: `Cotización N.º ${numero}`, text: mensaje });
    } else {
      descargar(f);
      const digitos = telefono?.replace(/\D/g, '') ?? '';
      window.open(`https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
    }
    if (estado === 'borrador') await marcar('enviada');
  });

  const porCorreo = () => correr(async () => {
    descargar(await archivo());
    window.location.href = `mailto:${correo ?? ''}?subject=${encodeURIComponent(`Cotización N.º ${numero} · JURMAQ`)}&body=${encodeURIComponent(`${mensaje}\n\nVa adjunta en este correo.`)}`;
    if (estado === 'borrador') await marcar('enviada');
  });

  const duplicar = () => correr(async () => {
    const r = await fetch(`/api/admin/cotizaciones/${id}/duplicar`, { method: 'POST' });
    const d = (await r.json().catch(() => ({}))) as { id?: number };
    if (!r.ok || !d.id) throw new Error('duplicar');
    router.push(`/admin/cotizaciones/${d.id}/editar`);
  });

  return (
    <div className="mt-6 space-y-3">
      <button type="button" className="boton boton-principal w-full" disabled={ocupado} onClick={compartir}>Enviar por WhatsApp</button>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="boton boton-suave" disabled={ocupado} onClick={porCorreo}>Enviar por correo</button>
        <button type="button" className="boton boton-suave" disabled={ocupado} onClick={() => correr(async () => descargar(await archivo()))}>Descargar PDF</button>
      </div>
      <button type="button" className="boton boton-suave w-full" disabled={ocupado} onClick={duplicar}>Duplicar</button>
      <div>
        <label className="etiqueta" htmlFor="estado">Estado</label>
        <select id="estado" className="campo" value={estado} disabled={ocupado} onChange={(e) => correr(() => marcar(e.target.value))}>
          {ESTADOS_COTIZACION.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
          {!(ESTADOS_COTIZACION as readonly string[]).includes(estado) ? <option value={estado}>{estado}</option> : null}
        </select>
      </div>
      {error ? <p role="alert" className="font-medium text-peligro">{error}</p> : null}
    </div>
  );
}
