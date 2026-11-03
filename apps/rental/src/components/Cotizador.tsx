'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCLP } from '@jurmaq/shared/format';
import { calcularTotales } from '@/lib/cotizacion';
import { UNIDAD_LABEL, type Maquina, type Unidad } from '@/lib/maquinas';
import { enlaceWhatsapp } from '@/lib/sitio';
import Foto from './Foto';

type Opcion = Pick<Maquina, 'id' | 'nombre' | 'precios' | 'minimoUnidades' | 'fotos' | 'fotoReferencial'>;

export default function Cotizador({ flota }: { flota: Opcion[] }) {
  const parametros = useSearchParams();
  const [maquinaId, setMaquinaId] = useState<number | ''>('');
  const [unidad, setUnidad] = useState<Unidad>('dia');
  const [cantidad, setCantidad] = useState('1');
  const [lugar, setLugar] = useState('');
  const [fecha, setFecha] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [notas, setNotas] = useState('');
  const [sitio, setSitio] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [numero, setNumero] = useState('');

  const maquina = useMemo(() => flota.find((m) => m.id === maquinaId) ?? null, [flota, maquinaId]);
  const unidades: Unidad[] = maquina?.precios.length ? maquina.precios.map((p) => p.unidad) : ['dia', 'semana', 'mes'];

  function elegir(id: number | '') {
    setMaquinaId(id);
    const m = flota.find((x) => x.id === id);
    const u = m?.precios[0]?.unidad;
    setUnidad(u ?? 'dia');
    if (m && u === 'hora' && m.minimoUnidades) setCantidad(String(m.minimoUnidades));
    else setCantidad('1');
  }

  useEffect(() => {
    const id = Number(parametros.get('m'));
    if (Number.isInteger(id) && flota.some((m) => m.id === id)) elegir(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros]);

  const n = Number(cantidad);
  const precio = maquina?.precios.find((p) => p.unidad === unidad);
  // Mismo mínimo que aplica el servidor.
  const aplicada = Math.max(n, unidad === 'hora' ? (maquina?.minimoUnidades ?? 1) : 1);
  const neto = precio && Number.isFinite(n) && n > 0
    ? calcularTotales([{ tipo: 'maquina', cantidad: aplicada, precio_unitario: precio.valor }], 0).neto
    : 0;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      const r = await fetch('/api/cotizar-arriendo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maquinaId, unidad, cantidad: n, lugar, fecha, nombre, telefono, correo, notas, sitio }),
      });
      const d = (await r.json().catch(() => ({}))) as { numero?: string; error?: string };
      if (!r.ok || !d.numero) {
        setError(d.error || 'No pudimos enviar tu solicitud. Escríbenos por WhatsApp.');
        return;
      }
      setNumero(d.numero);
    } catch {
      setError('Sin conexión. Intenta de nuevo o escríbenos por WhatsApp.');
    } finally {
      setEnviando(false);
    }
  }

  if (numero) {
    return (
      <div className="mt-8 max-w-2xl bg-acento p-6 text-[#111]" role="status">
        <h2 className="text-3xl">Recibimos tu solicitud</h2>
        <p className="mt-2">Tu número es <strong>{numero}</strong>. Te contactamos con la cotización.</p>
      </div>
    );
  }

  const wa = maquina ? `Hola, quiero cotizar el arriendo de ${maquina.nombre}${lugar ? ` en ${lugar}` : ''}.` : 'Hola, quiero cotizar el arriendo de una máquina.';

  return (
    <form onSubmit={enviar} className="mt-8 grid gap-8 md:grid-cols-[1.25fr_1fr] md:gap-14">
      <div className="space-y-5">
      <div>
        <label className="etiqueta" htmlFor="maquina">Máquina</label>
        <select id="maquina" className="campo" required value={maquinaId} onChange={(e) => elegir(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Elige una máquina</option>
          {flota.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiqueta" htmlFor="cantidad">Cuánto tiempo</label>
          <input id="cantidad" className="campo" type="number" inputMode="decimal" min="0.5" max="999" step="0.5" required value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="unidad">Por</label>
          <select id="unidad" className="campo" value={unidad} onChange={(e) => setUnidad(e.target.value as Unidad)}>
            {unidades.map((u) => <option key={u} value={u}>{UNIDAD_LABEL[u].varios}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="lugar">Comuna o dirección de la obra</label>
          <input id="lugar" className="campo" required maxLength={200} autoComplete="street-address" value={lugar} onChange={(e) => setLugar(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="fecha">Fecha de inicio</label>
          <input id="fecha" className="campo" type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="nombre">Tu nombre</label>
          <input id="nombre" className="campo" required maxLength={120} autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className="etiqueta" htmlFor="telefono">Teléfono</label>
          <input id="telefono" className="campo" type="tel" required maxLength={30} autoComplete="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="etiqueta" htmlFor="correo">Correo</label>
        <input id="correo" className="campo" type="email" required maxLength={254} autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
      </div>

      <div>
        <label className="etiqueta" htmlFor="notas">Cuéntanos del trabajo (opcional)</label>
        <textarea id="notas" className="campo" rows={3} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="sitio">No llenar</label>
        <input id="sitio" tabIndex={-1} autoComplete="off" value={sitio} onChange={(e) => setSitio(e.target.value)} />
      </div>

      </div>

      <div className="md:sticky md:top-24 md:self-start">
        {maquina ? <Foto maquina={maquina} className="mb-px aspect-[16/10]" /> : null}
        <div className="bg-acento p-5 text-[#111]">
          <p className="font-medium">{maquina ? maquina.nombre : 'Valor referencial'}</p>
          {neto > 0 ? (
            <p className="mt-1 font-titulo text-5xl font-semibold tabular-nums">{formatCLP(neto)}</p>
          ) : (
            <p className="mt-1 font-semibold">Te lo enviamos en la cotización</p>
          )}
          <p className="mt-2 text-[0.9375rem]">{neto > 0 ? '+ IVA. Valor referencial. ' : ''}El traslado se cotiza aparte.</p>
        </div>

        {error ? <p role="alert" className="mt-4 font-medium text-peligro">{error}</p> : null}

        <div className="sobre-claro mt-4 grid gap-3">
          <button type="submit" className="boton boton-principal w-full" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</button>
          <a href={enlaceWhatsapp(wa)} rel="noopener" className="boton boton-secundario w-full">Prefiero WhatsApp</a>
        </div>
      </div>
    </form>
  );
}
