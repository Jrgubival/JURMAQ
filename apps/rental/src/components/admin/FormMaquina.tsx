'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ESTADOS_MAQUINA, TIPOS_PANEL } from '@/lib/opciones';
import { UNIDADES, UNIDAD_LABEL, type Maquina, type PrecioPeriodo, type Unidad } from '@/lib/maquinas';

/** Achica en el teléfono: una foto de 8 MB sube en segundos y pesa poco en el sitio. */
async function achicar(archivo: File): Promise<Blob> {
  const imagen = await createImageBitmap(archivo);
  const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();
  return new Promise((ok, mal) =>
    lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('foto'))), 'image/jpeg', 0.82),
  );
}

type Fila = Omit<PrecioPeriodo, 'valor'> & { valor: string };

export default function FormMaquina({ maquina }: { maquina?: Maquina }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(maquina?.nombre ?? '');
  const [tipo, setTipo] = useState(maquina?.tipo ?? TIPOS_PANEL[0].valor);
  const [descripcion, setDescripcion] = useState(maquina?.descripcion ?? '');
  const [estado, setEstado] = useState(maquina?.estado ?? 'disponible');
  const [publicada, setPublicada] = useState(maquina?.publicada ?? true);
  const [referencial, setReferencial] = useState(maquina?.fotoReferencial ?? false);
  const [fotos, setFotos] = useState<string[]>(maquina?.fotos ?? []);
  const [precios, setPrecios] = useState<Fila[]>(
    (maquina?.precios ?? []).map((p) => ({ ...p, valor: String(p.valor) })),
  );
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [guardado, setGuardado] = useState(false);

  const libres = UNIDADES.filter((u) => !precios.some((p) => p.unidad === u));

  function cambiarPrecio(i: number, parte: Partial<Fila>) {
    setPrecios((l) => l.map((p, j) => (j === i ? { ...p, ...parte } : p)));
  }

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (archivos.length === 0) return;
    setError('');
    setSubiendo(true);
    try {
      for (const archivo of archivos) {
        const form = new FormData();
        form.append('foto', await achicar(archivo), 'foto.jpg');
        const r = await fetch('/api/admin/fotos', { method: 'POST', body: form });
        const d = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!r.ok || !d.url) throw new Error(d.error);
        setFotos((l) => [...l, d.url as string].slice(0, 8));
        // Una foto subida desde el panel se asume de la máquina real.
        setReferencial(false);
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setGuardado(false);
    setGuardando(true);
    try {
      const r = await fetch(maquina ? `/api/admin/maquinas/${maquina.id}` : '/api/admin/maquinas', {
        method: maquina ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          tipo,
          descripcion,
          estado,
          publicada,
          fotoReferencial: referencial,
          fotos,
          precios: precios.map((p) => ({ unidad: p.unidad, valor: Number(p.valor), incluye: p.incluye })),
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!r.ok) {
        setError(d.error || 'No se pudo guardar.');
        return;
      }
      if (!maquina && d.id) {
        router.push(`/admin/maquinas/${d.id}`);
        return;
      }
      setGuardado(true);
      router.refresh();
    } catch {
      setError('Sin conexión. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mt-4 space-y-5">
      <div>
        <label className="etiqueta" htmlFor="nombre">Nombre</label>
        <input id="nombre" className="campo" required maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="tipo">Tipo</label>
          <select id="tipo" className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_PANEL.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor="estado">Disponibilidad</label>
          <select id="estado" className="campo" value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS_MAQUINA.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="etiqueta" htmlFor="descripcion">Descripción</label>
        <textarea id="descripcion" className="campo" rows={3} maxLength={1000} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
      </div>

      <fieldset>
        <legend className="etiqueta">Valores (sin IVA)</legend>
        {precios.length === 0 ? <p className="text-ink-muted">Sin valores, el sitio muestra "Cotizar".</p> : null}
        <ul className="space-y-3">
          {precios.map((p, i) => (
            <li key={p.unidad} className="rounded-[var(--g-radio)] border border-hairline bg-surface p-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="etiqueta" htmlFor={`pe-${i}`}>Período</label>
                <label className="etiqueta" htmlFor={`va-${i}`}>Valor</label>
                <select id={`pe-${i}`} className="campo" value={p.unidad} onChange={(e) => cambiarPrecio(i, { unidad: e.target.value as Unidad })}>
                  {UNIDADES.filter((u) => u === p.unidad || libres.includes(u)).map((u) => <option key={u} value={u}>Por {UNIDAD_LABEL[u].uno}</option>)}
                </select>
                <input id={`va-${i}`} className="campo" type="number" inputMode="numeric" min="1" step="1" required value={p.valor} onChange={(e) => cambiarPrecio(i, { valor: e.target.value })} />
              </div>
              <label className="etiqueta mt-3" htmlFor={`in-${i}`}>Qué incluye</label>
              <input id={`in-${i}`} className="campo" maxLength={160} placeholder="Ej: mínimo 6 horas" value={p.incluye} onChange={(e) => cambiarPrecio(i, { incluye: e.target.value })} />
              <button type="button" className="mt-2 text-lg underline underline-offset-4" onClick={() => { if (window.confirm('¿Quitar este valor?')) setPrecios((l) => l.filter((_, j) => j !== i)); }}>Quitar</button>
            </li>
          ))}
        </ul>
        {libres.length > 0 ? (
          <button type="button" className="boton boton-suave mt-3" onClick={() => setPrecios((l) => [...l, { unidad: libres[0], valor: '', incluye: '' }])}>Agregar valor</button>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="etiqueta">Fotos</legend>
        <p className="text-lg text-ink-muted">La primera es la principal.</p>
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((f, i) => (
            <li key={f} className="rounded-[var(--g-radio)] border border-hairline bg-surface p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full rounded object-cover" />
              <div className="mt-2 flex justify-between text-lg">
                {i > 0 ? <button type="button" className="underline underline-offset-4" onClick={() => setFotos((l) => [f, ...l.filter((x) => x !== f)])}>Principal</button> : <span>Principal</span>}
                <button type="button" className="underline underline-offset-4" onClick={() => { if (window.confirm('¿Quitar esta foto?')) setFotos((l) => l.filter((x) => x !== f)); }}>Quitar</button>
              </div>
            </li>
          ))}
        </ul>
        <label className="boton boton-suave mt-3 cursor-pointer">
          {subiendo ? 'Subiendo…' : 'Subir fotos'}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={subiendo || fotos.length >= 8} onChange={subir} />
        </label>
        <label className="mt-3 flex min-h-12 items-center gap-3">
          <input type="checkbox" className="h-6 w-6" checked={referencial} onChange={(e) => setReferencial(e.target.checked)} />
          Mostrar "Imagen referencial" sobre la foto
        </label>
      </fieldset>

      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" className="h-6 w-6" checked={publicada} onChange={(e) => setPublicada(e.target.checked)} />
        Mostrar en el sitio
      </label>

      {error ? <p role="alert" className="font-medium text-peligro">{error}</p> : null}
      {guardado ? <p role="status" className="font-medium text-exito">{publicada ? 'Guardado y publicado.' : 'Guardado. No se muestra en el sitio.'}</p> : null}
      <button type="submit" className="boton boton-principal w-full" disabled={guardando || subiendo}>{guardando ? 'Guardando…' : 'Guardar'}</button>
    </form>
  );
}
