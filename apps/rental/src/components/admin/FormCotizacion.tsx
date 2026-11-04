'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCLP } from '@jurmaq/shared/format';
import { calcularTotales, type TipoLinea, type UnidadLinea } from '@/lib/cotizacion';
import { VALIDEZ_DIAS } from '@/lib/sitio';
import type { PrecioPeriodo } from '@/lib/maquinas';

type Opcion = { id: number; nombre: string; precios: PrecioPeriodo[] };

interface Linea {
  clave: number;
  tipo: TipoLinea;
  maquinaria_id: number | null;
  descripcion: string;
  detalle: string;
  cantidad: string;
  unidad: UnidadLinea;
  precio: string;
}

export interface Inicial {
  solicitud_id?: number | null;
  cliente_nombre?: string;
  cliente_rut?: string | null;
  cliente_contacto?: string | null;
  contacto_email?: string | null;
  cliente_telefono?: string | null;
  cliente_direccion?: string | null;
  servicio_detalle?: string | null;
  entrega_at?: string | null;
  retiro_fecha?: string | null;
  destino_nombre?: string | null;
  ubicacion_servicio?: string | null;
  validez_dias?: number | null;
  descuento_neto?: number;
  notas_cliente?: string | null;
  lineas?: {
    tipo: TipoLinea;
    maquinaria_id: number | null;
    descripcion: string;
    detalle: string | null;
    cantidad: number;
    unidad: UnidadLinea;
    precio_unitario: number;
  }[];
}

const ADICIONALES: { tipo: TipoLinea; texto: string; descripcion: string; unidad: UnidadLinea }[] = [
  { tipo: 'traslado', texto: 'Traslado', descripcion: 'Traslado de ida', unidad: 'viaje' },
  { tipo: 'alojamiento', texto: 'Alojamiento', descripcion: 'Alojamiento', unidad: 'noche' },
  { tipo: 'operador', texto: 'Operador', descripcion: 'Operador', unidad: 'dia' },
  { tipo: 'otro', texto: 'Otro', descripcion: '', unidad: 'global' },
];

const UNIDADES_FORM: { valor: UnidadLinea; texto: string }[] = [
  { valor: 'hora', texto: 'Horas' },
  { valor: 'dia', texto: 'Días' },
  { valor: 'semana', texto: 'Semanas' },
  { valor: 'mes', texto: 'Meses' },
  { valor: 'viaje', texto: 'Viajes' },
  { valor: 'noche', texto: 'Noches' },
  { valor: 'global', texto: 'Global' },
];

let contador = 0;
const clave = () => ++contador;

function Campo({ id, texto, valor, cambiar, tipo = 'text', max = 200 }: { id: string; texto: string; valor: string; cambiar: (v: string) => void; tipo?: string; max?: number }) {
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>{texto}</label>
      <input id={id} className="campo" type={tipo} maxLength={tipo === 'text' ? max : undefined} value={valor} onChange={(e) => cambiar(e.target.value)} />
    </div>
  );
}

export default function FormCotizacion({ catalogo, inicial, id }: { catalogo: Opcion[]; inicial?: Inicial; id?: number }) {
  const router = useRouter();
  const [nombre, setNombre] = useState(inicial?.cliente_nombre ?? '');
  const [rut, setRut] = useState(inicial?.cliente_rut ?? '');
  const [contacto, setContacto] = useState(inicial?.cliente_contacto ?? '');
  const [correo, setCorreo] = useState(inicial?.contacto_email ?? '');
  const [telefono, setTelefono] = useState(inicial?.cliente_telefono ?? '');
  const [direccion, setDireccion] = useState(inicial?.cliente_direccion ?? '');
  const [detalle, setDetalle] = useState(inicial?.servicio_detalle ?? '');
  const [entrega, setEntrega] = useState(inicial?.entrega_at ?? '');
  const [retiro, setRetiro] = useState(inicial?.retiro_fecha ?? '');
  const [destino, setDestino] = useState(inicial?.destino_nombre ?? '');
  const [lugar, setLugar] = useState(inicial?.ubicacion_servicio ?? '');
  const [validez, setValidez] = useState(String(inicial?.validez_dias ?? VALIDEZ_DIAS));
  const [descuento, setDescuento] = useState(String(inicial?.descuento_neto ?? 0));
  const [notas, setNotas] = useState(inicial?.notas_cliente ?? '');
  const [lineas, setLineas] = useState<Linea[]>(
    (inicial?.lineas ?? []).map((l) => ({
      clave: clave(),
      tipo: l.tipo,
      maquinaria_id: l.maquinaria_id,
      descripcion: l.descripcion,
      detalle: l.detalle ?? '',
      cantidad: String(l.cantidad),
      unidad: l.unidad,
      precio: String(l.precio_unitario),
    })),
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const totales = useMemo(
    () =>
      calcularTotales(
        lineas.map((l) => ({ tipo: l.tipo, cantidad: Number(l.cantidad) || 0, precio_unitario: Number(l.precio) || 0 })),
        Number(descuento) || 0,
      ),
    [lineas, descuento],
  );

  function cambiar(c: number, parte: Partial<Linea>) {
    setLineas((l) => l.map((x) => (x.clave === c ? { ...x, ...parte } : x)));
  }

  function agregarMaquina(idTexto: string) {
    const m = catalogo.find((x) => x.id === Number(idTexto));
    if (!m) return;
    const p = m.precios[0];
    setLineas((l) => [...l, {
      clave: clave(),
      tipo: 'maquina',
      maquinaria_id: m.id,
      descripcion: `Arriendo de ${m.nombre}`,
      detalle: '',
      cantidad: '1',
      unidad: p?.unidad ?? 'dia',
      precio: p ? String(p.valor) : '',
    }]);
  }

  function cambiarUnidad(l: Linea, unidad: UnidadLinea) {
    const m = catalogo.find((x) => x.id === l.maquinaria_id);
    const p = m?.precios.find((x) => x.unidad === unidad);
    cambiar(l.clave, { unidad, ...(p ? { precio: String(p.valor) } : {}) });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!lineas.some((l) => l.tipo === 'maquina')) {
      setError('Agrega al menos una máquina.');
      return;
    }
    setGuardando(true);
    try {
      const r = await fetch(id ? `/api/admin/cotizaciones/${id}` : '/api/admin/cotizaciones', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nombre: nombre,
          cliente_rut: rut,
          cliente_contacto: contacto,
          contacto_email: correo,
          cliente_telefono: telefono,
          cliente_direccion: direccion,
          servicio_detalle: detalle,
          entrega_at: entrega,
          retiro_fecha: retiro,
          destino_nombre: destino,
          ubicacion_servicio: lugar,
          validez_dias: Number(validez) >= 1 ? Math.round(Number(validez)) : VALIDEZ_DIAS,
          descuento_neto: Number(descuento) || 0,
          notas_cliente: notas,
          ...(inicial?.solicitud_id ? { solicitud_id: inicial.solicitud_id } : {}),
          lineas: lineas.map((l) => ({
            tipo: l.tipo,
            maquinaria_id: l.maquinaria_id,
            descripcion: l.descripcion,
            detalle: l.detalle,
            cantidad: Number(l.cantidad),
            unidad: l.unidad,
            precio_unitario: Number(l.precio),
          })),
        }),
      });
      const d = (await r.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!r.ok) {
        setError(d.error || 'No se pudo guardar.');
        return;
      }
      router.push(`/admin/cotizaciones/${id ?? d.id}`);
      router.refresh();
    } catch {
      setError('Sin conexión. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mt-4 space-y-6">
      <section className="space-y-3">
        <div>
          <label className="etiqueta" htmlFor="nombre">Cliente</label>
          <input id="nombre" className="campo" required maxLength={160} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="telefono" texto="Teléfono" tipo="tel" valor={telefono} cambiar={setTelefono} />
          <Campo id="correo" texto="Correo" tipo="email" valor={correo} cambiar={setCorreo} />
        </div>
        <details>
          <summary className="min-h-12 cursor-pointer content-center font-medium">Más datos del cliente</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Campo id="rut" texto="RUT" valor={rut} cambiar={setRut} max={20} />
            <Campo id="contacto" texto="Contacto" valor={contacto} cambiar={setContacto} />
            <div className="sm:col-span-2"><Campo id="direccion" texto="Dirección" valor={direccion} cambiar={setDireccion} /></div>
          </div>
        </details>
      </section>

      <section>
        <h2 className="text-2xl">Máquinas</h2>
        <ul className="mt-3 space-y-3">
          {lineas.map((l) => (
            <li key={l.clave} className="rounded-[var(--g-radio)] border border-hairline bg-surface p-3">
              <label className="etiqueta" htmlFor={`d-${l.clave}`}>Descripción</label>
              <input id={`d-${l.clave}`} className="campo" required maxLength={300} value={l.descripcion} onChange={(e) => cambiar(l.clave, { descripcion: e.target.value })} />
              {l.tipo === 'maquina' ? (
                <div className="mt-2">
                  <label className="etiqueta" htmlFor={`p-${l.clave}`}>Período (opcional)</label>
                  <input id={`p-${l.clave}`} className="campo" maxLength={300} placeholder="Ej: 24 al 27 de noviembre" value={l.detalle} onChange={(e) => cambiar(l.clave, { detalle: e.target.value })} />
                </div>
              ) : null}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="etiqueta" htmlFor={`c-${l.clave}`}>Cantidad</label>
                  <input id={`c-${l.clave}`} className="campo" type="number" inputMode="decimal" min="0.5" max="999" step="0.5" required value={l.cantidad} onChange={(e) => cambiar(l.clave, { cantidad: e.target.value })} />
                </div>
                <div>
                  <label className="etiqueta" htmlFor={`u-${l.clave}`}>Unidad</label>
                  <select id={`u-${l.clave}`} className="campo" value={l.unidad} onChange={(e) => cambiarUnidad(l, e.target.value as UnidadLinea)}>
                    {UNIDADES_FORM.map((u) => <option key={u.valor} value={u.valor}>{u.texto}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="etiqueta" htmlFor={`v-${l.clave}`}>Precio neto</label>
                  <input id={`v-${l.clave}`} className="campo" type="number" inputMode="numeric" min="0" step="1" required value={l.precio} onChange={(e) => cambiar(l.clave, { precio: e.target.value })} />
                </div>
              </div>
              <div className="mt-2 flex justify-between text-lg">
                <button type="button" className="min-h-12 text-peligro underline underline-offset-4" onClick={() => { if (window.confirm('¿Quitar esta línea?')) setLineas((x) => x.filter((y) => y.clave !== l.clave)); }}>Quitar</button>
                <span className="font-semibold">{formatCLP(Math.round((Number(l.cantidad) || 0) * (Number(l.precio) || 0)))}</span>
              </div>
            </li>
          ))}
        </ul>
        <select aria-label="Agregar máquina" className="campo mt-3" value="" onChange={(e) => agregarMaquina(e.target.value)}>
          <option value="">Agregar máquina…</option>
          {catalogo.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ADICIONALES.map((a) => (
            <button
              key={a.tipo}
              type="button"
              className="boton boton-suave"
              onClick={() => setLineas((l) => [...l, { clave: clave(), tipo: a.tipo, maquinaria_id: null, descripcion: a.descripcion, detalle: '', cantidad: '1', unidad: a.unidad, precio: '' }])}
            >
              + {a.texto}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl">Servicio</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="entrega" texto="Entrega" tipo="datetime-local" valor={entrega} cambiar={setEntrega} />
          <Campo id="retiro" texto="Retiro" tipo="date" valor={retiro} cambiar={setRetiro} />
          <Campo id="destino" texto="Destino" valor={destino} cambiar={setDestino} max={160} />
          <Campo id="lugar" texto="Dirección del destino" valor={lugar} cambiar={setLugar} max={250} />
        </div>
        <details>
          <summary className="min-h-12 cursor-pointer content-center font-medium">Más opciones</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Campo id="detalle" texto="Detalle del equipo, ej: Altura: 16 m" valor={detalle} cambiar={setDetalle} /></div>
            <Campo id="descuento" texto="Descuento neto" tipo="number" valor={descuento} cambiar={setDescuento} />
            <Campo id="validez" texto="Validez en días" tipo="number" valor={validez} cambiar={setValidez} />
            <div className="sm:col-span-2">
              <label className="etiqueta" htmlFor="notas">Notas</label>
              <textarea id="notas" className="campo" rows={3} maxLength={1000} value={notas} onChange={(e) => setNotas(e.target.value)} />
            </div>
          </div>
        </details>
      </section>

      {error ? <p role="alert" className="font-medium text-peligro">{error}</p> : null}

      <div className="sticky bottom-3 z-10 rounded-[var(--g-radio)] border border-hairline bg-surface p-3 md:bottom-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-lg text-ink-muted">Neto {formatCLP(totales.neto)} · IVA {formatCLP(totales.iva)}</span>
          <span className="font-titulo text-2xl">{formatCLP(totales.total)}</span>
        </div>
        <button type="submit" className="boton boton-principal w-full" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}
