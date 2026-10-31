/**
 * Causas objetivas por las que la barraca puede no aprobar un pedido ya
 * hecho (Términos 8.4). Lista cerrada: nunca por su sola voluntad.
 * Sin dependencias de servidor: también la usa el panel.
 */
export const MOTIVOS_RECHAZO = {
  sin_stock: 'Falta de stock',
  error_precio: 'Error evidente de precio',
  sin_despacho: 'No podemos despachar a esa dirección',
  pago_fraude: 'Pago rechazado o sospecha de fraude',
  datos_falsos: 'Datos del pedido falsos o incompletos, sin corregir',
  cantidad_maxima: 'Supera la cantidad máxima por pedido',
} as const;
export type MotivoRechazo = keyof typeof MOTIVOS_RECHAZO;

/** Por qué se canceló un pedido (los "no aprobados" usan MOTIVOS_RECHAZO). */
export const MOTIVOS_CANCELACION = {
  cliente: 'A pedido del cliente',
  transferencia_no_recibida: 'Transferencia no recibida',
  vencido: 'Sin pago en 48 horas',
  otro: 'Otro motivo',
} as const;
export type MotivoCancelacion = keyof typeof MOTIVOS_CANCELACION;
