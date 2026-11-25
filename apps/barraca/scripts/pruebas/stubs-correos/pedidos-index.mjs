// Solo lo que usa correos.ts de lib/pedidos/index.ts (que arrastra Supabase y archivos).
export { MOTIVOS_RECHAZO, MOTIVOS_CANCELACION } from "../../../src/lib/pedidos/motivos.ts";
export const ETIQUETA_ESTADO = {
  pendiente_pago: "Pendiente de pago", transferencia_informada: "Transferencia informada", pagado: "Pagado", pago_rechazado: "Pago rechazado",
  pago_discrepancia: "Pago por revisar", en_preparacion: "En preparación", listo_retiro: "Listo para retiro", despachado: "Despachado",
  entregado: "Entregado", cancelado: "Cancelado", rechazado: "No aprobado (devolución)",
};
