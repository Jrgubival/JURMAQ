import 'server-only';
import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { calcularTotales } from './cotizacion';
import type { CotizacionEntrada } from './esquemas';

/**
 * Columnas de cabecera. Totales recalculados aquí, nunca los del cliente.
 * `cliente_email` y `cliente_id` quedan vacíos a propósito: /cuenta busca por
 * ahí, y el cliente no debe ver en su portal estas cotizaciones.
 */
export function cabecera(d: CotizacionEntrada) {
  const t = calcularTotales(d.lineas, d.descuento_neto);
  const primera = d.lineas.find((l) => l.tipo === 'maquina' && l.maquinaria_id);
  if (!primera?.maquinaria_id || t.total >= 9_999_999_999) return null;
  const unidad = primera.unidad === 'hora' || primera.unidad === 'dia' || primera.unidad === 'semana' || primera.unidad === 'mes'
    ? primera.unidad
    : 'dia';
  return {
    maquinaria_id: primera.maquinaria_id,
    cliente_nombre: d.cliente_nombre,
    cliente_rut: d.cliente_rut || null,
    cliente_contacto: d.cliente_contacto || null,
    contacto_email: d.contacto_email || null,
    cliente_telefono: d.cliente_telefono || null,
    cliente_direccion: d.cliente_direccion || null,
    servicio_detalle: d.servicio_detalle || null,
    entrega_at: d.entrega_at || null,
    retiro_fecha: d.retiro_fecha || null,
    fecha_servicio: d.entrega_at ? d.entrega_at.slice(0, 10) : null,
    destino_nombre: d.destino_nombre || null,
    ubicacion_servicio: d.ubicacion_servicio || null,
    validez_dias: d.validez_dias,
    descuento_neto: d.descuento_neto,
    notas_cliente: d.notas_cliente || null,
    unidades_solicitadas: primera.cantidad,
    unidad,
    precio_uso: t.maquinas,
    traslado_combustible: t.traslados,
    traslado_operario: t.otros,
    subtotal_neto: t.neto,
    iva: t.iva,
    total: t.total,
    snapshot_tarifa_neta: primera.precio_unitario,
  };
}

export function filasLineas(id: number, lineas: CotizacionEntrada['lineas']) {
  return lineas.map((l, orden) => ({
    cotizacion_id: id,
    orden,
    tipo: l.tipo,
    maquinaria_id: l.maquinaria_id ?? null,
    descripcion: l.descripcion,
    detalle: l.detalle || null,
    cantidad: l.cantidad,
    unidad: l.unidad,
    precio_unitario: l.precio_unitario,
  }));
}

export async function crearCotizacion(cab: NonNullable<ReturnType<typeof cabecera>>, lineas: CotizacionEntrada['lineas'], extras: { solicitud_id?: number | null }) {
  const { data: numero, error: errNumero } = await supabaseAdmin.rpc('next_cot_panel_numero');
  if (errNumero || !numero) return null;
  const { data, error } = await supabaseAdmin
    .from('cotizaciones_arriendo')
    .insert({
      ...cab,
      numero,
      origen: 'panel',
      estado: 'borrador',
      solicitud_id: extras.solicitud_id ?? null,
      snapshot_costo_km: 0,
      snapshot_costo_hora_operario: 0,
      snapshot_mantencion_pct: 0,
      snapshot_utilidad_pct: 0,
    })
    .select('id, numero')
    .single();
  if (error || !data) return null;
  const { error: errLineas } = await supabaseAdmin.from('cotizacion_arriendo_lineas').insert(filasLineas(data.id, lineas));
  if (errLineas) {
    // La cotización queda cancelada: su número no se reutiliza ni deja hueco.
    await supabaseAdmin.from('cotizaciones_arriendo').update({ estado: 'cancelada' }).eq('id', data.id);
    return null;
  }
  return data;
}
