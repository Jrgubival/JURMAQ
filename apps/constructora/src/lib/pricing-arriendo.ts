/**
 * Pricing engine para sistema de arriendo v2.
 *
 * Calcula el costo total de un servicio de arriendo siguiendo el algoritmo
 * documentado en MAQUINARIAS_PRICING.md:
 *
 *   precio_uso         = tarifa_neta × max(unidades_solicitadas, mínimo)
 *   km_total           = distancia_km × 2  (ida + vuelta)
 *   traslado_comb      = km_total × costo_km
 *   traslado_carga     = carga_descarga_horas × costo_hora_operario
 *   traslado_operario  = horas_operario × costo_hora_operario
 *   subtotal_neto      = precio_uso + traslado_comb + traslado_carga + traslado_operario + peajes
 *   iva                = subtotal_neto × 0.19
 *   total              = subtotal_neto + iva
 *
 *   // Internos (NO se muestran al cliente):
 *   reserva_mantencion = subtotal_neto × mantencion_pct
 *   utilidad_real      = subtotal_neto × utilidad_pct
 *
 * IVA Chile 2026: 19%.
 */

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
  unidades_solicitadas: number;        // horas o días según maquinaria.unidad_tarifa
  distancia_km?: number;                // 0 si maquinaria.requiere_traslado=false o pickup
  peajes?: number;                      // CLP, default 0
  operarios?: number;                   // default 1
  horas_operario_estimadas?: number;    // default 0 (solo carga/descarga)
}

export interface CotizacionDesglose {
  // Inputs efectivos (después de aplicar mínimos)
  unidades_aplicadas: number;
  km_total: number;
  // Componentes (todo NETO)
  precio_uso: number;
  traslado_combustible: number;
  traslado_carga: number;
  traslado_operario: number;
  peajes: number;
  subtotal_neto: number;
  iva: number;
  total: number;
  // Internos (admin only)
  reserva_mantencion: number;
  utilidad_real: number;
}

const IVA_RATE = 0.19;

/**
 * Calcula la cotización completa con desglose.
 *
 * Reglas:
 *  - Si `unidades_solicitadas < maquinaria.minimo_unidades`, se cobra el mínimo.
 *  - Si `maquinaria.requiere_traslado=false`, traslado_combustible y traslado_carga = 0.
 *  - peajes se suma al subtotal pero no genera IVA adicional (se asume IVA ya incluido en peaje).
 *    Si querés tratarlos como gasto, asumir net entonces el sistema multiplica por 1.19.
 *  - Todo redondeado a entero (CLP no usa centavos).
 */
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

  // 1. Precio de uso (aplicar mínimo)
  const unidades_aplicadas = Math.max(unidades_solicitadas, maquinaria.minimo_unidades);
  const precio_uso = Math.round(maquinaria.tarifa_neta * unidades_aplicadas);

  // 2. Traslado combustible (ida + vuelta)
  const km_total = Math.round(distancia_km * 2 * 10) / 10; // 1 decimal
  const traslado_combustible = maquinaria.requiere_traslado
    ? Math.round(km_total * tarifas.costo_km)
    : 0;

  // 3. Carga y descarga (tiempo fijo)
  const traslado_carga = maquinaria.requiere_traslado
    ? Math.round(tarifas.carga_descarga_horas * tarifas.costo_hora_operario * operarios)
    : 0;

  // 4. Operario tiempo trabajado
  const traslado_operario = Math.round(horas_operario_estimadas * tarifas.costo_hora_operario * operarios);

  // 5. Subtotal neto
  const subtotal_neto = precio_uso + traslado_combustible + traslado_carga + traslado_operario + peajes;

  // 6. IVA
  const iva = Math.round(subtotal_neto * IVA_RATE);

  // 7. Total con IVA
  const total = subtotal_neto + iva;

  // 8. Internos
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

/**
 * Validación de inputs antes de calcular. Retorna primer error o null.
 */
export function validarInput(input: Partial<CotizacionInput>): string | null {
  if (!input.maquinaria) return 'maquinaria es requerida';
  if (!input.tarifas) return 'tarifas es requerida';
  if (input.unidades_solicitadas === undefined || input.unidades_solicitadas <= 0) {
    return 'unidades_solicitadas debe ser > 0';
  }
  if (input.distancia_km !== undefined && input.distancia_km < 0) {
    return 'distancia_km no puede ser negativa';
  }
  if (input.peajes !== undefined && input.peajes < 0) {
    return 'peajes no puede ser negativo';
  }
  if (input.operarios !== undefined && (input.operarios < 1 || input.operarios > 10)) {
    return 'operarios debe estar entre 1 y 10';
  }
  if (input.horas_operario_estimadas !== undefined && input.horas_operario_estimadas < 0) {
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
