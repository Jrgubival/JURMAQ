'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [errores, setErrores] = useState<Record<string, string>>({});
  const confirmacion = useRef<HTMLDivElement>(null);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

  // La confirmación reemplaza un formulario largo: sin esto queda fuera de la vista.
  useEffect(() => {
    if (!numero) return;
    confirmacion.current?.scrollIntoView({ block: 'center' });
    confirmacion.current?.focus();
  }, [numero]);

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

  const minimo = unidad === 'hora' ? (maquina?.minimoUnidades ?? 1) : 1;

  function revisar(campo: string, valor: string): string {
    if (campo === 'maquina') return valor ? '' : 'Elige una máquina.';
    if (campo === 'cantidad') return Number(valor) > 0 ? '' : 'Indica cuánto tiempo.';
    if (campo === 'lugar') return valor.trim().length >= 2 ? '' : 'Indica la comuna o dirección.';
    if (campo === 'fecha') {
      if (!valor) return 'Elige la fecha de inicio.';
      return valor < hoy ? 'Esa fecha ya pasó.' : '';
    }
    if (campo === 'nombre') return valor.trim().length >= 2 ? '' : 'Escribe tu nombre.';
    if (campo === 'telefono') return /^[0-9+ ()-]{8,30}$/.test(valor.trim()) ? '' : 'Escribe un teléfono, por ejemplo +56 9 1234 5678.';
    if (campo === 'correo') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim()) ? '' : 'Escribe un correo válido.';
    return '';
  }

  function alSalir(campo: string, valor: string) {
    setErrores((x) => ({ ...x, [campo]: revisar(campo, valor) }));
  }

  function aviso(campo: string) {
    return errores[campo] ? <p id={`${campo}-error`} className="mt-1 text-[0.9375rem] font-medium text-peligro">{errores[campo]}</p> : null;
  }

  function aria(campo: string) {
    return errores[campo] ? { 'aria-invalid': true, 'aria-describedby': `${campo}-error` } : {};
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const valores: Record<string, string> = { maquina: String(maquinaId), cantidad, lugar, fecha, nombre, telefono, correo };
    const nuevos = Object.fromEntries(Object.entries(valores).map(([c, v]) => [c, revisar(c, v)]));
    setErrores(nuevos);
    const primero = Object.keys(valores).find((c) => nuevos[c]);
    if (primero) {
      document.getElementById(primero)?.focus();
      return;
    }
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
      <div ref={confirmacion} tabIndex={-1} className="mt-8 max-w-2xl bg-surface-alt p-6 text-ink outline-none" role="status">
        <h2 className="text-3xl">Recibimos tu solicitud</h2>
        <p className="mt-2">Tu número es <strong>{numero}</strong>. Te contactamos con la cotización.</p>
      </div>
    );
  }

  const wa = maquina ? `Hola, quiero cotizar el arriendo de ${maquina.nombre}${lugar ? ` en ${lugar}` : ''}.` : 'Hola, quiero cotizar el arriendo de una máquina.';

  return (
    <form onSubmit={enviar} noValidate className="mt-8 grid gap-8 md:grid-cols-[1.25fr_1fr] md:gap-14">
      <div className="space-y-5">
      <div>
        <label className="etiqueta" htmlFor="maquina">Máquina</label>
        <select id="maquina" className="campo" {...aria('maquina')} value={maquinaId} onChange={(e) => { elegir(e.target.value ? Number(e.target.value) : ''); setErrores((x) => ({ ...x, maquina: '' })); }}>
          <option value="">Elige una máquina</option>
          {flota.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        {aviso('maquina')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiqueta" htmlFor="cantidad">Cuánto tiempo</label>
          <input id="cantidad" className="campo" type="number" inputMode="decimal" min={minimo} max="999" step="0.5" {...aria('cantidad')} value={cantidad} onBlur={(e) => alSalir('cantidad', e.target.value)} onChange={(e) => setCantidad(e.target.value)} />
          {aviso('cantidad')}
        </div>
        <div>
          <label className="etiqueta" htmlFor="unidad">Por</label>
          <select id="unidad" className="campo" value={unidad} onChange={(e) => setUnidad(e.target.value as Unidad)}>
            {unidades.map((u) => <option key={u} value={u}>{UNIDAD_LABEL[u].varios}</option>)}
          </select>
        </div>
      </div>
      {n > 0 && n < minimo ? <p className="font-medium">Mínimo {minimo} horas: calculamos {minimo}.</p> : null}
      {neto > 0 ? <p aria-live="polite" className="font-semibold md:hidden">Referencia: {formatCLP(neto)} + IVA, sin traslado</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="lugar">Comuna o dirección de la obra</label>
          <input id="lugar" className="campo" maxLength={200} autoComplete="street-address" value={lugar} onChange={(e) => setLugar(e.target.value)} {...aria('lugar')} onBlur={(e) => alSalir('lugar', e.target.value)} />
          {aviso('lugar')}
        </div>
        <div>
          <label className="etiqueta" htmlFor="fecha">Fecha de inicio</label>
          <input id="fecha" className="campo" type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} {...aria('fecha')} onBlur={(e) => alSalir('fecha', e.target.value)} />
          {aviso('fecha')}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="nombre">Tu nombre</label>
          <input id="nombre" className="campo" maxLength={120} autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} {...aria('nombre')} onBlur={(e) => alSalir('nombre', e.target.value)} />
          {aviso('nombre')}
        </div>
        <div>
          <label className="etiqueta" htmlFor="telefono">Teléfono</label>
          <input id="telefono" className="campo" type="tel" maxLength={30} autoComplete="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} {...aria('telefono')} onBlur={(e) => alSalir('telefono', e.target.value)} />
          {aviso('telefono')}
        </div>
      </div>

      <div>
        <label className="etiqueta" htmlFor="correo">Correo</label>
        <input id="correo" className="campo" type="email" maxLength={254} autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} {...aria('correo')} onBlur={(e) => alSalir('correo', e.target.value)} />
          {aviso('correo')}
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
        {maquina ? <Foto maquina={maquina} className="mb-px hidden aspect-[16/10] md:block" /> : null}
        <div className="hidden bg-negro p-5 text-white md:block">
          <p className="font-medium">{maquina ? maquina.nombre : 'Valor referencial'}</p>
          {neto > 0 ? (
            <p className="mt-1 font-titulo text-5xl tabular-nums">{formatCLP(neto)}</p>
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
