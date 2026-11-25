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
    "Programa un precio de oferta que EMPIEZA Y TERMINA SOLO en las fechas dadas (hora de Chile, formato AAAA-MM-DDTHH:MM; sin inicio empieza ahora). Al empezar, el precio web baja al de la oferta y el precio normal (tachado) queda como el precio local de hoy; al terminar vuelve el precio anterior, salvo que alguien lo haya cambiado entre medio (ahí no se pisa y queda un aviso en ver_ofertas). Indica productos (codigo y precio_oferta de cada uno) o codigos con descuento_pct sobre el precio web actual. Hasta 5 productos se programan de una vez; más de 5 se hacen en dos pasos: modo 'previsualizar' (resumen y un id de un solo uso) y después modo 'confirmar' con vista_previa_id. El precio de oferta debe ser menor al precio web actual. Si queda bajo el costo, con menos de 15 % sobre el costo o con más de 30 % de rebaja, queda pendiente de la aprobación de Jorge (repite la misma llamada cuando apruebe). No se envían correos a clientes.",
  esquema: z.object({
    productos: z.array(z.object({
      codigo: z.string().trim().min(1).max(40),
      precio_oferta: z.number().describe("Pesos enteros mayores a 0, menor al precio web actual."),
    })).max(300).optional().describe("Cada producto con su precio de oferta."),
    codigos: z.array(z.string().trim().min(1).max(40)).max(300).optional().describe("Con descuento_pct: productos que reciben el mismo % de rebaja."),
    descuento_pct: z.number().min(0.01).max(90).optional().describe("Rebaja sobre el precio web actual, hasta 2 decimales."),
    inicio: z.string().trim().max(25).optional().describe("AAAA-MM-DDTHH:MM en hora de Chile. Sin esto, empieza ahora."),
    fin: z.string().trim().max(25).describe("AAAA-MM-DDTHH:MM en hora de Chile (primer instante SIN oferta)."),
    nota: z.string().trim().max(200).optional().describe("Nota interna (por ejemplo, el nombre de la campaña)."),
    modo: z.enum(["previsualizar", "confirmar"]).optional().describe("Para más de 5 productos."),
    vista_previa_id: z.string().trim().min(6).max(20).optional().describe("Con modo 'confirmar': el id de la vista previa."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => programarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: async ({ db, entradas, ahora }) => revertirOfertas(db, await obtenerDeps(), entradas, ahora),
});

export const verOfertas = defineHerramienta({
  nombre: "ver_ofertas",
  titulo: "Ver ofertas programadas",
  descripcion:
    "Lista las ofertas con fecha: programadas, activas, y las terminadas, canceladas u omitidas. Muestra los AVISOS: por ejemplo cuando una oferta terminó pero no se devolvió el precio anterior porque alguien lo había cambiado antes. Por defecto muestra las vigentes (programadas o activas) más los avisos de los últimos 30 días.",
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
    "Cancela una oferta programada (no llega a empezar) o activa (termina ahora y vuelve el precio anterior, salvo las fichas que alguien cambió mientras tanto, que no se pisan y quedan con aviso). Indica UNA de estas cosas: oferta_id (el de ver_ofertas, completo o los 8 primeros caracteres), grupo_id (cancela todas las de esa programación) o codigo.",
  esquema: z.object({
    oferta_id: z.string().trim().max(40).optional(),
    grupo_id: z.string().trim().max(40).optional(),
    codigo: z.string().trim().max(40).optional(),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => cancelarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
});
