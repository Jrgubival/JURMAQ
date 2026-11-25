/**
 * Textos del local que usan los correos de pedido (dirección corta, horario,
 * teléfono para WhatsApp, correo de contacto), sacados de la fuente única
 * (`VistaLocal`, src/lib/contenido). Puro: se prueba sin servidor.
 *
 * Con el respaldo en código (D1 vacía) los textos son EXACTAMENTE los que antes
 * estaban escritos a mano en `correos.ts`:
 *   "Av. Poniente 2157, Molina", "Lunes a viernes 8:30–13:00 y 14:30–18:00",
 *   "Sábado 9:00–13:00", "+56 9 7667 3577", "contacto@jurmaq.cl".
 */
import type { VistaLocal } from "../contenido/derivados.ts";

export interface TextosLocal {
  /** "Av. Poniente 2157, Molina". */
  direccionCorta: string;
  /** "Lunes a viernes 8:30–13:00 y 14:30–18:00". */
  horarioSemana: string;
  /** "Sábado 9:00–13:00". */
  horarioSabado: string;
  /** Todo el horario en una frase. */
  horarioTexto: string;
  /** Número de WhatsApp para leer: "+56 9 7667 3577". */
  whatsappDisplay: string;
  /** Correo de contacto del local. */
  email: string;
}

/** "56976673577" → "+56 9 7667 3577". Un número con otra forma se muestra como "+<dígitos>". */
export function formatoWhatsapp(numero: string): string {
  const d = String(numero ?? "").replace(/\D/g, "");
  const m = /^56(9)(\d{4})(\d{4})$/.exec(d);
  if (m) return `+56 ${m[1]} ${m[2]} ${m[3]}`;
  return d ? `+${d}` : "";
}

export function textosLocal(v: Pick<VistaLocal, "direccionCorta" | "h" | "whatsapp" | "email">): TextosLocal {
  return {
    direccionCorta: v.direccionCorta,
    horarioSemana: v.h.semana,
    horarioSabado: v.h.sabado,
    horarioTexto: v.h.texto,
    whatsappDisplay: formatoWhatsapp(v.whatsapp),
    email: v.email,
  };
}
