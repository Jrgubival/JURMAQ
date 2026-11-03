import 'server-only';
import { redirect } from 'next/navigation';
import { auth } from '@jurmaq/shared/auth';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import type { CotizacionPdf } from './pdf-cotizacion';
import type { TipoLinea, UnidadLinea } from './cotizacion';

/** Para páginas del panel. Las rutas de API usan requirePermission en cada handler. */
export async function exigirSesion() {
  const sesion = await auth();
  if (!sesion?.user) redirect('/api/login/salir');
  return sesion;
}

export interface LineaGuardada {
  tipo: TipoLinea;
  maquinaria_id: number | null;
  descripcion: string;
  detalle: string | null;
  cantidad: number;
  unidad: UnidadLinea;
  precio_unitario: number;
}

export interface CotizacionGuardada {
  id: number;
  numero: string;
  estado: string;
  origen: string;
  fecha_emision: string;
  cliente_nombre: string;
  cliente_rut: string | null;
  cliente_contacto: string | null;
  contacto_email: string | null;
  cliente_telefono: string | null;
  cliente_direccion: string | null;
  servicio_detalle: string | null;
  entrega_at: string | null;
  retiro_fecha: string | null;
  destino_nombre: string | null;
  ubicacion_servicio: string | null;
  validez_dias: number | null;
  descuento_neto: number;
  notas_cliente: string | null;
  solicitud_id: number | null;
  subtotal_neto: number;
  iva: number;
  total: number;
  lineas: LineaGuardada[];
}

export async function leerCotizacion(id: number): Promise<CotizacionGuardada | null> {
  const { data } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .select('*, lineas:cotizacion_arriendo_lineas(tipo, maquinaria_id, descripcion, detalle, cantidad, unidad, precio_unitario, orden)')
    .eq('id', id)
    .eq('origen', 'panel')
    .maybeSingle();
  if (!data) return null;
  const fila = data as unknown as CotizacionGuardada & { lineas: (LineaGuardada & { orden: number })[] };
  const lineas = [...fila.lineas]
    .sort((a, b) => a.orden - b.orden)
    .map(({ orden: _orden, ...l }) => ({ ...l, cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario) }));
  return {
    ...fila,
    subtotal_neto: Number(fila.subtotal_neto),
    iva: Number(fila.iva),
    total: Number(fila.total),
    descuento_neto: Number(fila.descuento_neto),
    lineas,
  };
}

function fechaChile(iso: string | null): string | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function datosPdf(c: CotizacionGuardada, equipo: string, correo: string): CotizacionPdf {
  const hora = c.entrega_at?.match(/[T ](\d{2}:\d{2})/)?.[1];
  const entrega = fechaChile(c.entrega_at);
  return {
    numero: c.numero,
    fecha: fechaChile(c.fecha_emision) ?? '',
    correoEmpresa: correo,
    cliente: {
      nombre: c.cliente_nombre,
      rut: c.cliente_rut,
      contacto: c.cliente_contacto,
      correo: c.contacto_email,
      telefono: c.cliente_telefono,
      direccion: c.cliente_direccion,
    },
    servicio: {
      equipo,
      detalle: c.servicio_detalle,
      entrega: entrega ? `${entrega}${hora ? `, ${hora}` : ''}` : null,
      retiro: fechaChile(c.retiro_fecha),
    },
    destino: c.destino_nombre || c.ubicacion_servicio
      ? { nombre: c.destino_nombre, direccion: c.ubicacion_servicio }
      : null,
    lineas: c.lineas.map((l) => ({
      descripcion: l.descripcion,
      detalle: l.detalle,
      cantidad: l.cantidad,
      unidad: l.unidad,
      precio: l.precio_unitario,
    })),
    descuento: c.descuento_neto,
    validezDias: c.validez_dias,
    notas: c.notas_cliente,
  };
}
