export interface MaquinariaPricing {
  id: number;
  nombre: string;
  tarifa_neta: number;
  unidad_tarifa: 'hora' | 'dia';
  minimo_unidades: number;
  requiere_traslado: boolean;
}

export interface TarifasTraslado {
  costo_km: number;
  costo_hora_operario: number;
  carga_descarga_horas: number;
  reserva_mantencion_pct: number;
  reserva_utilidad_pct: number;
}

export interface CotizacionInput {
  maquinaria: MaquinariaPricing;
  tarifas: TarifasTraslado;
  unidades_solicitadas: number;
  distancia_km?: number;
  peajes?: number;
  operarios?: number;
  horas_operario_estimadas?: number;
}

export interface CotizacionDesglose {
  unidades_aplicadas: number;
  km_total: number;
  precio_uso: number;
  traslado_combustible: number;
  traslado_carga: number;
  traslado_operario: number;
  peajes: number;
  subtotal_neto: number;
  iva: number;
  total: number;
  reserva_mantencion: number;
  utilidad_real: number;
}

const IVA_RATE = 0.19;

export function calcularCotizacion(input: CotizacionInput): CotizacionDesglose {
  const {
    maquinaria,
    tarifas,
    unidades_solicitadas,
    distancia_km = 0,
    peajes = 0,
    operarios = 1,
    horas_operario_estimadas = 0,
  } = input;

  const unidades_aplicadas = Math.max(unidades_solicitadas, maquinaria.minimo_unidades);
  const precio_uso = Math.round(maquinaria.tarifa_neta * unidades_aplicadas);

  const km_total = Math.round(distancia_km * 2 * 10) / 10;
  const traslado_combustible = maquinaria.requiere_traslado
    ? Math.round(km_total * tarifas.costo_km)
    : 0;

  const traslado_carga = maquinaria.requiere_traslado
    ? Math.round(tarifas.carga_descarga_horas * tarifas.costo_hora_operario * operarios)
    : 0;

  const traslado_operario = Math.round(horas_operario_estimadas * tarifas.costo_hora_operario * operarios);

  const subtotal_neto = precio_uso + traslado_combustible + traslado_carga + traslado_operario + peajes;

  const iva = Math.round(subtotal_neto * IVA_RATE);

  const total = subtotal_neto + iva;

  const reserva_mantencion = Math.round(subtotal_neto * tarifas.reserva_mantencion_pct);
  const utilidad_real = Math.round(subtotal_neto * tarifas.reserva_utilidad_pct);

  return {
    unidades_aplicadas,
    km_total,
    precio_uso,
    traslado_combustible,
    traslado_carga,
    traslado_operario,
    peajes,
    subtotal_neto,
    iva,
    total,
    reserva_mantencion,
    utilidad_real,
  };
}

export function validarInput(input: Partial<CotizacionInput>): string | null {
  if (!input.maquinaria) return 'maquinaria es requerida';
  if (!input.tarifas) return 'tarifas es requerida';
  // Number.isFinite descarta también NaN, que evade toda comparación (<, >, <=)
  // y venía de Number(campo) con strings no numéricos en el POST público.
  if (
    input.unidades_solicitadas === undefined ||
    !Number.isFinite(input.unidades_solicitadas) ||
    input.unidades_solicitadas <= 0
  ) {
    return 'unidades_solicitadas debe ser > 0';
  }
  if (input.distancia_km !== undefined && (!Number.isFinite(input.distancia_km) || input.distancia_km < 0)) {
    return 'distancia_km no puede ser negativa';
  }
  if (input.peajes !== undefined && (!Number.isFinite(input.peajes) || input.peajes < 0)) {
    return 'peajes no puede ser negativo';
  }
  if (input.peajes !== undefined && input.peajes > 1_000_000) {
    return 'peajes superior a $1.000.000 — verificar manualmente con cliente';
  }
  if (
    input.operarios !== undefined &&
    (!Number.isInteger(input.operarios) || input.operarios < 1 || input.operarios > 10)
  ) {
    return 'operarios debe estar entre 1 y 10';
  }
  if (
    input.horas_operario_estimadas !== undefined &&
    (!Number.isFinite(input.horas_operario_estimadas) || input.horas_operario_estimadas < 0)
  ) {
    return 'horas_operario_estimadas no puede ser negativa';
  }
  if (input.maquinaria.tarifa_neta === undefined || input.maquinaria.tarifa_neta <= 0) {
    return 'maquinaria no tiene tarifa_neta configurada';
  }
  if (!['hora', 'dia'].includes(input.maquinaria.unidad_tarifa)) {
    return 'maquinaria.unidad_tarifa debe ser "hora" o "dia"';
  }
  return null;
}

export interface DisponibilidadResultado {
  disponible: boolean;
  conflictos: Array<{
    tipo: 'bloqueo' | 'cotizacion' | 'contrato';
    fecha_inicio: string;
    fecha_fin: string;
    motivo?: string;
    numero?: string;
    estado?: string;
  }>;
  /** Si fue null, la verificación falló y debe tratarse como "no disponible" (fail-closed). */
  errorVerificando?: boolean;
}

export async function verificarDisponibilidad(
  maquinariaId: number,
  fechaInicio: string,
  fechaFin: string,
): Promise<DisponibilidadResultado> {
  const { supabaseAdmin } = await import('@jurmaq/shared/supabase');

  const { data, error } = await supabaseAdmin.rpc('verificar_disponibilidad_maquinaria', {
    p_maquinaria_id: maquinariaId,
    p_fecha_inicio: fechaInicio,
    p_fecha_fin: fechaFin,
  });

  // B-1 fail-closed: si el RPC falla, NO asumir disponible. Antes devolvía
  // `disponible: true` lo que enmascaraba el bug del nombre incorrecto del
  // RPC. Ahora marca errorVerificando y deja al caller decidir.
  if (error) {
    console.error('[verificarDisponibilidad] RPC error', { maquinariaId, error });
    return { disponible: false, conflictos: [], errorVerificando: true };
  }
  if (!data || data.length === 0) {
    // RPC ejecutó OK y devolvió 0 filas (no hay conflictos). Esto es lo
    // esperado cuando la máquina está libre.
    return { disponible: true, conflictos: [] };
  }

  const row = data[0];
  return {
    disponible: row.disponible,
    conflictos: (row.conflictos || []).map((c: Record<string, unknown>) => {
      // Las claves de fecha varían según el tipo. Normalizamos.
      const fechaInicioRaw =
        c.fecha_inicio ?? c.fecha_servicio ?? c.fecha_emision ?? null;
      const fechaFinRaw = c.fecha_fin ?? c.fecha_termino ?? c.fecha_servicio ?? null;
      return {
        tipo: c.tipo as 'bloqueo' | 'cotizacion' | 'contrato',
        fecha_inicio: fechaInicioRaw ? String(fechaInicioRaw) : '',
        fecha_fin: fechaFinRaw ? String(fechaFinRaw) : '',
        motivo: c.motivo ? String(c.motivo) : undefined,
        numero: c.numero ? String(c.numero) : undefined,
        estado: c.estado ? String(c.estado) : undefined,
      };
    }),
  };
}

export function precioPublicoDesde(m: {
  tarifa_neta?: number | null;
  unidad_tarifa?: string | null;
  minimo_unidades?: number | null;
}): number | null {
  if (!m.tarifa_neta || m.tarifa_neta <= 0) return null;
  if (m.unidad_tarifa !== 'hora' && m.unidad_tarifa !== 'dia') return null;
  // Mostrar el "desde" en la MISMA unidad de la tarifa. Antes, para items
  // por hora, multiplicábamos × minimo_unidades y lo etiquetábamos como /día
  // — confuso. El card debe leer "$X / hora" cuando es hora y "$X / día"
  // cuando es día, en ambos casos NETO (sin IVA).
  return Math.round(Number(m.tarifa_neta));
}

// Para SORT: normalizar a jornada-equivalente. Sin esto, ítems por hora
// quedarían siempre primero en "precio_asc" porque su número es 1/8 del
// de los ítems por día. Mantenemos precioPublicoDesde para display, y este
// helper aparte para comparar.
export function precioJornadaEstimada(m: {
  tarifa_neta?: number | null;
  unidad_tarifa?: string | null;
  minimo_unidades?: number | null;
}): number | null {
  if (!m.tarifa_neta || m.tarifa_neta <= 0) return null;
  if (m.unidad_tarifa !== 'hora' && m.unidad_tarifa !== 'dia') return null;
  const minimo = Math.max(Number(m.minimo_unidades) || 1, 1);
  const base = m.unidad_tarifa === 'hora'
    ? Number(m.tarifa_neta) * minimo
    : Number(m.tarifa_neta);
  return Math.round(base);
}
