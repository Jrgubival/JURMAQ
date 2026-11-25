/**
 * Variables de un correo a partir del pedido y los datos del local. Puro.
 * Los valores van SIN escapar: el armado (render.ts) escapa todo lo que va en HTML.
 */
import { formatCLP } from "./utils.ts";
import type { TextosLocal } from "../pedidos/textos-local.ts";
import type { VariablesCorreo } from "./plantillas.ts";

interface PedidoMinimo {
  nombre: string;
  numero: string;
  total: number;
}

export function variablesCorreo(p: PedidoMinimo, loc: Partial<TextosLocal>, extra: VariablesCorreo = {}): VariablesCorreo {
  return {
    nombre: p.nombre.split(" ")[0],
    numero_pedido: p.numero,
    total: formatCLP(p.total),
    email_tienda: loc.email ?? "",
    whatsapp_tienda: loc.whatsappDisplay ?? "",
    direccion_tienda: loc.direccionCorta ?? "",
    horario_semana: loc.horarioSemana ?? "",
    horario_sabado: loc.horarioSabado ?? "",
    ...extra,
  };
}
