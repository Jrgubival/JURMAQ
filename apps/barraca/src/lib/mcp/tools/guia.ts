import { defineHerramienta, z } from "./registro.ts";

/**
 * Herramienta base `guia`: explica a Claude cómo trabajar con la tienda. Las
 * demás piezas la completan agregando secciones en SECCIONES (o más temas).
 */
export const TEMAS = ["general", "aprobaciones", "deshacer", "herramientas"] as const;

const SECCIONES: Record<(typeof TEMAS)[number], string> = {
  general: [
    "Esta conexión te deja administrar la tienda en línea de JURMAQ Barraca para Jorge.",
    "Primero lee, después propone, y solo al final cambia. Antes de un cambio importante muéstrale a Jorge qué va a pasar (vista previa) y espera su confirmación.",
    "Todo cambio queda registrado y se puede deshacer desde el panel (Administración, Conexiones).",
    "Habla siempre en español de Chile simple. No inventes datos: si falta un precio, un costo o un texto, pregúntalo.",
  ].join("\n"),
  aprobaciones: [
    "Algunos cambios no se aplican solos: necesitan que Jorge los apruebe desde un enlace que le llega por correo.",
    "Eso pasa cuando: se toca más de 300 productos o algún precio se mueve más de 30 % (cuenta lo hecho en las últimas 24 horas, aunque se haga en partes); un precio queda bajo el costo o menos de 15 % sobre el costo; cambia el 2 % de descuento por transferencia, el despacho o el envío gratis; se publican los términos o la privacidad; se enciende el interruptor de cupones; se cambian los textos de correos a clientes.",
    "Si la aprobación está pendiente, avísale a Jorge que revise su correo y NO repitas el cambio. Si los datos cambian mientras tanto, la aprobación vence y hay que pedirla de nuevo.",
  ].join("\n"),
  deshacer: [
    "Cada llamada que cambia datos crea un lote. En el panel, Administración > Conexiones, Jorge puede deshacer un lote completo con un botón.",
    "Dile a Jorge el resultado de cada cambio con palabras simples y menciona que se puede deshacer.",
  ].join("\n"),
  herramientas: "",
};

export const guia = defineHerramienta({
  nombre: "guia",
  titulo: "Guía de uso de la tienda",
  descripcion:
    "Lee esto primero. Explica cómo trabajar con la tienda de JURMAQ Barraca: reglas, cambios que piden aprobación, cómo se deshace y qué herramientas hay. Tema opcional: general, aprobaciones, deshacer o herramientas.",
  esquema: z.object({ tema: z.enum(TEMAS).optional().describe("Tema a leer. Si no lo indicas, lees la guía general.") }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  async ejecutar({ tema }, ctx) {
    const t = tema ?? "general";
    if (t === "herramientas") {
      const lineas = ctx.catalogo.map((h) => `- ${h.nombre} (${h.soloLectura ? "solo lee" : "cambia datos"}): ${h.titulo}. ${h.descripcion}`);
      return { texto: lineas.join("\n"), datos: { herramientas: ctx.catalogo.map((h) => h.nombre) } };
    }
    return { texto: SECCIONES[t], datos: { tema: t } };
  },
});
