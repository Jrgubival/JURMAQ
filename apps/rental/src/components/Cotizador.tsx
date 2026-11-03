'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatCLP } from '@jurmaq/shared/format';
import { calcularTotales } from '@/lib/cotizacion';
import { UNIDAD_LABEL, type Maquina, type Unidad } from '@/lib/maquinas';
import { enlaceWhatsapp } from '@/lib/sitio';

type Opcion = Pick<Maquina, 'id' | 'nombre' | 'precios' | 'minimoUnidades'>;

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
    if (u) setUnidad(u);
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
  const neto = precio && Number.isFinite(n) && n > 0
    ? calcularTotales([{ tipo: 'maquina', cantidad: n, precio_unitario: precio.valor }], 0).neto
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
      <div className="mt-6 rounded-xl border border-hairline bg-surface p-6" role="status">
        <h2 className="text-3xl">Recibimos tu solicitud</h2>
        <p className="mt-2 text-ink-soft">Tu número es <strong>{numero}</strong>. Te contactamos con la cotización.</p>
      </div>
    );
  }

  const wa = maquina ? `Hola, quiero cotizar el arriendo de ${maquina.nombre}${lugar ? ` en ${lugar}` : ''}.` : 'Hola, quiero cotizar el arriendo de una máquina.';

  return (
    <form onSubmit={enviar} className="mt-6 space-y-5">
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

      <div className="rounded-xl border border-hairline bg-surface p-4">
        <p className="text-sm text-ink-muted">Valor referencial</p>
        {neto > 0 ? (
          <p className="font-titulo text-3xl font-semibold">{formatCLP(neto)} <span className="font-sans text-sm font-normal text-ink-muted">+ IVA</span></p>
        ) : (
          <p className="font-semibold">Te lo enviamos en la cotización</p>
        )}
        <p className="mt-1 text-sm text-ink-muted">El traslado se cotiza aparte.</p>
      </div>

      {error ? <p role="alert" className="font-medium text-peligro">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="boton boton-principal" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar solicitud'}</button>
        <a href={enlaceWhatsapp(wa)} rel="noopener" className="boton boton-secundario">Prefiero WhatsApp</a>
      </div>
    </form>
  );
}
