/**
 * Herramientas de productos y categorías: buscar, ver, listar, márgenes (lectura)
 * y editar/crear (escritura con auditoría, deshacer y reglas de aprobación).
 * La lógica vive en lib/gestion-precios/; aquí solo se declara la interfaz.
 */
import { buscarProductos as buscarSrv, listarCategorias as listarCatSrv, verMargenes as margenesSrv, verProducto as verSrv } from "../../gestion-precios/consultas.ts";
import { crearCategoria as crearCatSrv, crearProducto as crearSrv, editarCategoria as editarCatSrv, editarProducto as editarSrv } from "../../gestion-precios/productos-servicio.ts";
import { defineHerramienta, z } from "./registro.ts";
import { aCtxGestion, ejecutarServicio, obtenerDeps, revertidorGeneral } from "./productos-comun.ts";

const LECTURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
const codigo = z.string().trim().min(1).max(40);

export const buscarProductos = defineHerramienta({
  nombre: "buscar_productos",
  titulo: "Buscar productos",
  descripcion:
    "Busca productos de la tienda por texto (nombre o código), código exacto, categoría, estado (visible u oculto), sin foto, sin stock o en oferta. Devuelve una página corta de fichas con precio web, precio normal (local), stock y si tiene foto. No muestra costos (para eso, ver_producto). Usa pagina para ver más resultados.",
  esquema: z.object({
    texto: z.string().trim().max(100).optional().describe("Parte del nombre o del código."),
    codigo: codigo.optional().describe("Código exacto del producto."),
    categoria_id: z.number().int().positive().optional().describe("Id de la categoría (mira listar_categorias)."),
    incluir_subcategorias: z.boolean().optional().describe("Con categoria_id: incluir también sus subcategorías. Por defecto sí."),
    estado: z.enum(["activo", "inactivo", "todos"]).optional().describe("Por defecto solo los visibles en la tienda."),
    sin_foto: z.boolean().optional().describe("Solo productos sin imagen."),
    sin_stock: z.boolean().optional().describe("Solo productos con stock 0 o sin dato de stock."),
    solo_oferta: z.boolean().optional().describe("Solo productos con precio normal tachado (en oferta)."),
    pagina: z.number().int().min(1).max(500).optional(),
    por_pagina: z.number().int().min(1).max(50).optional().describe("Resultados por página (máximo 50, por defecto 20)."),
  }),
  anotaciones: LECTURA,
  ejecutar: async (args) => ejecutarServicio(async () => buscarSrv(await obtenerDeps(), args)),
});

export const verProducto = defineHerramienta({
  nombre: "ver_producto",
  titulo: "Ver un producto",
  descripcion:
    "Muestra TODAS las fichas de un código (hay códigos con fichas repetidas): precio web, precio normal (local), costo, utilidad sobre el costo, stock, si está visible, categoría, imagen, combo y ofertas programadas. Indica el código (o el id de una ficha).",
  esquema: z.object({
    codigo: codigo.optional().describe("Código del producto."),
    id: z.number().int().positive().optional().describe("Id de una ficha (alternativa al código)."),
  }),
  anotaciones: LECTURA,
  ejecutar: async (args, ctx) => ejecutarServicio(async () => verSrv(await obtenerDeps(), ctx.db, args)),
});

export const listarCategorias = defineHerramienta({
  nombre: "listar_categorias",
  titulo: "Listar categorías",
  descripcion: "Lista las categorías de la tienda con su id, orden, cuántos productos activos tiene cada una y si está activa. Úsala para conocer los ids antes de buscar o cambiar precios por categoría.",
  esquema: z.object({ incluir_inactivas: z.boolean().optional().describe("Incluir las categorías ocultas. Por defecto no.") }),
  anotaciones: LECTURA,
  ejecutar: async (args) => ejecutarServicio(async () => listarCatSrv(await obtenerDeps(), args)),
});

export const verMargenes = defineHerramienta({
  nombre: "ver_margenes",
  titulo: "Ver márgenes",
  descripcion:
    "Revisa la utilidad sobre el costo de los productos activos: cuántos están bajo el costo, cuántos con menos de 15 % sobre el costo y cuántos no tienen costo cargado, más los casos más delgados. Se puede filtrar por categoría. Es el mismo criterio que usa la tienda para pedir la aprobación de Jorge.",
  esquema: z.object({
    categoria_id: z.number().int().positive().optional().describe("Solo esta categoría (y sus subcategorías)."),
    limite: z.number().int().min(1).max(50).optional().describe("Cuántos casos delgados listar (por defecto 25)."),
  }),
  anotaciones: LECTURA,
  ejecutar: async (args) => ejecutarServicio(async () => margenesSrv(await obtenerDeps(), args)),
});

export const editarProducto = defineHerramienta({
  nombre: "editar_producto",
  titulo: "Editar un producto",
  descripcion:
    "Cambia datos de UN producto por su código; el cambio llega a todas sus fichas repetidas. Se puede cambiar nombre, descripción, precio web (lo que se cobra), precio local (el precio normal tachado; null lo quita), stock, si está visible (activo; nunca se borra), imagen (URL ya subida a la tienda), categoría, combo (combo_cantidad y combo_precio juntos; null en ambos lo quita) y oferta_fin (fecha informativa; para una oferta que empiece y termine sola usa programar_oferta). Si el precio web queda bajo el costo o con menos de 15 % sobre el costo, o se mueve más de 30 %, el cambio queda PENDIENTE de la aprobación de Jorge: avisa que revise su correo y repite la misma llamada cuando apruebe. Para muchos productos usa previsualizar_precios. Queda registrado y se puede deshacer.",
  esquema: z.object({
    codigo: codigo.describe("Código del producto."),
    nombre: z.string().trim().min(1).max(200).optional(),
    descripcion: z.string().max(4000).nullable().optional().describe("Texto plano; null la borra."),
    precio_web: z.number().optional().describe("Pesos enteros mayores a 0. Es lo que paga el cliente en la web."),
    precio_local: z.number().nullable().optional().describe("Pesos enteros mayores a 0: precio normal del local (se muestra tachado). null = quitar el tachado."),
    en_oferta: z.boolean().optional().describe("false apaga el tachado; true exige que el precio local sea mayor al web. Normalmente no hace falta: queda solo según precio_local y precio_web."),
    oferta_fin: z.string().max(10).nullable().optional().describe("AAAA-MM-DD, solo informativa. null la quita."),
    combo_cantidad: z.number().int().nullable().optional().describe("Unidades del combo (2 a 999). null junto a combo_precio null quita el combo."),
    combo_precio: z.number().nullable().optional().describe("Precio TOTAL del combo en pesos enteros."),
    stock: z.number().min(0).max(10_000_000).optional(),
    activo: z.boolean().optional().describe("false oculta el producto de la tienda (no se borra)."),
    imagen: z.string().max(500).nullable().optional().describe("URL de una imagen ya subida a la tienda."),
    categoria_id: z.number().int().positive().optional(),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => editarSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});

export const crearProducto = defineHerramienta({
  nombre: "crear_producto",
  titulo: "Crear un producto",
  descripcion:
    "Crea un producto nuevo con código, nombre, precio web y, si quieres, precio local, costo, stock, categoría, descripción e imagen (URL ya subida). Queda OCULTO en la tienda hasta que se active (activo: true aquí o después con editar_producto). No acepta un código que ya exista. Si el precio queda bajo el costo o con menos de 15 % sobre el costo, queda pendiente de la aprobación de Jorge. Se puede deshacer (queda oculto; nunca se borra).",
  esquema: z.object({
    codigo: codigo,
    nombre: z.string().trim().min(1).max(200),
    precio_web: z.number().describe("Pesos enteros mayores a 0."),
    precio_local: z.number().optional().describe("Precio normal del local (tachado); debe ser igual o mayor al precio web."),
    costo: z.number().optional().describe("Costo en pesos enteros."),
    stock: z.number().min(0).max(10_000_000).optional(),
    categoria_id: z.number().int().positive().optional(),
    descripcion: z.string().max(4000).optional(),
    imagen: z.string().max(500).optional().describe("URL de una imagen ya subida a la tienda."),
    activo: z.boolean().optional().describe("Por defecto false: queda oculto hasta activarlo."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => crearSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});

export const crearCategoria = defineHerramienta({
  nombre: "crear_categoria",
  titulo: "Crear una categoría",
  descripcion: "Crea una categoría nueva (opcionalmente dentro de otra con padre_id). Queda al final del orden. Se puede deshacer (queda inactiva; nunca se borra).",
  esquema: z.object({
    nombre: z.string().trim().min(1).max(80),
    descripcion: z.string().max(500).optional(),
    padre_id: z.number().int().positive().optional().describe("Id de la categoría madre (listar_categorias)."),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => crearCatSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});

export const editarCategoria = defineHerramienta({
  nombre: "editar_categoria",
  titulo: "Editar una categoría",
  descripcion: "Renombra, reordena, activa o desactiva una categoría (nunca se borra). El orden es un número: menor se muestra primero. Si la desactivas, avisa cuántos productos activos dejarían de mostrarse ahí. Se puede deshacer.",
  esquema: z.object({
    id: z.number().int().positive().describe("Id de la categoría (listar_categorias)."),
    nombre: z.string().trim().min(1).max(80).optional(),
    orden: z.number().int().min(0).max(100000).optional(),
    activa: z.boolean().optional(),
    descripcion: z.string().max(500).nullable().optional(),
  }),
  anotaciones: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  ejecutar: async (args, ctx) => ejecutarServicio(async () => editarCatSrv(await obtenerDeps(), aCtxGestion(ctx), args)),
  revertidor: revertidorGeneral,
});
