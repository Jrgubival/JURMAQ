/**
 * Ofertas con vigencia: programar (empiezan y terminan solas), ver y cancelar.
 */
import { cancelarOferta as cancelarSrv, programarOferta as programarSrv, revertirOfertas, verOfertas as verSrv } from "../../gestion-precios/ofertas.ts";
import { defineHerramienta, z } from "./registro.ts";
import { aCtxGestion, ejecutarServicio, obtenerDeps } from "./productos-comun.ts";

export const programarOferta = defineHerramienta({
  nombre: "programar_oferta",
  titulo: "Programar una oferta con fecha",
  descripcion:
    "Programa un precio de oferta que empieza y termina solo (hora de Chile, AAAA-MM-DDTHH:MM; sin inicio, empieza ahora). Al empezar el precio web baja y el normal (tachado) queda como el precio local de hoy; al terminar vuelve el anterior, salvo que alguien lo haya cambiado (no se pisa; queda aviso en ver_ofertas). Pasa productos (codigo + precio_oferta) o codigos con descuento_pct sobre el precio web. Hasta 5 productos de una vez; más, en dos pasos (modo 'previsualizar' y luego 'confirmar' con vista_previa_id). El precio de oferta debe ser menor al web. Bajo el costo, menos de 15 % de utilidad o más de 30 % de rebaja pide el OK de Jorge (repite la misma llamada). No envía correos.",
  esquema: z.object({
    productos: z.array(z.object({
      codigo: z.string().trim().min(1).max(40),
      precio_oferta: z.number().describe("Pesos enteros, menor al web actual."),
    })).max(300).optional().describe("Producto y su precio de oferta."),
    codigos: z.array(z.string().trim().min(1).max(40)).max(300).optional().describe("Con descuento_pct: mismo % para todos."),
    descuento_pct: z.number().min(0.01).max(90).optional().describe("Rebaja sobre el precio web (2 decimales)."),
    inicio: z.string().trim().max(25).optional().describe("AAAA-MM-DDTHH:MM en hora de Chile. Sin esto, empieza ahora."),
    fin: z.string().trim().max(25).describe("AAAA-MM-DDTHH:MM, hora de Chile (primer instante SIN oferta)."),
    nota: z.string().trim().max(200).optional().describe("Nota interna."),
    modo: z.enum(["previsualizar", "confirmar"]).optional().describe("Para más de 5 productos."),
    vista_previa_id: z.string().trim().min(6).max(20).optional().describe("Con modo confirmar."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => programarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: async ({ db, entradas, ahora }) => revertirOfertas(db, await obtenerDeps(), entradas, ahora),
});

export const verOfertas = defineHerramienta({
  nombre: "ver_ofertas",
  titulo: "Ver ofertas programadas",
  descripcion:
    "Lista las ofertas con fecha (programadas, activas, terminadas, canceladas u omitidas) y los AVISOS, p. ej. una oferta que terminó sin devolver el precio anterior porque alguien lo cambió. Por defecto: las vigentes y los avisos de los últimos 30 días.",
  esquema: z.object({
    estado: z.enum(["vigentes", "terminadas", "todas"]).optional(),
    codigo: z.string().trim().max(40).optional(),
    grupo_id: z.string().trim().max(40).optional().describe("El grupo que devolvió programar_oferta."),
    limite: z.number().int().min(1).max(50).optional(),
  }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => verSrv(ctx.db, args)),
});

export const cancelarOferta = defineHerramienta({
  nombre: "cancelar_oferta",
  titulo: "Cancelar una oferta",
  descripcion:
    "Cancela una oferta programada (no empieza) o activa (termina ahora y vuelve el precio anterior, salvo fichas que alguien cambió: no se pisan y queda aviso). Indica UNA: oferta_id (de ver_ofertas, completo o los 8 primeros caracteres), grupo_id (toda esa programación) o codigo.",
  esquema: z.object({
    oferta_id: z.string().trim().max(40).optional(),
    grupo_id: z.string().trim().max(40).optional(),
    codigo: z.string().trim().max(40).optional(),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => cancelarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
});
