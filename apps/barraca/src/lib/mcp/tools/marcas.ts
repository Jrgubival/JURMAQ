/**
 * Marcas del catálogo: SOLO LECTURA. La tienda no tiene campo ni tabla de marca: se reconoce por el nombre del
 * producto (`lib/marcas.ts`) y no hay páginas públicas de marca. Por eso no hay herramienta para asignar marcas
 * ni páginas de marca: esta herramienta muestra cuántos productos tiene cada marca reconocida y cuáles no tienen.
 */
import { MARCAS, detectarMarca, marcaPorSlug } from "../../marcas.ts";
import { ErrorGestion } from "../../gestion-precios/precios-masivos.ts";
import { defineHerramienta, z } from "./registro.ts";
import { ejecutarSeo, obtenerDepsSeo } from "./seo-comun.ts";

export const verMarcasHerramienta = defineHerramienta({
  nombre: "ver_marcas",
  titulo: "Ver las marcas reconocidas del catálogo",
  descripcion:
    "Solo lectura. La marca no es un dato: se reconoce por el nombre del producto. Sin parámetros: cuántos productos activos tiene cada marca y cuántos no tienen. Con 'marca' (slug, p. ej. tolmat) lista hasta 40 productos; con 'ninguna', los sin marca reconocida. No se asignan marcas desde aquí.",
  esquema: z.object({ marca: z.string().trim().min(1).max(40).optional() }),
  anotaciones: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  ejecutar: async (a) =>
    ejecutarSeo(async () => {
      const deps = await obtenerDepsSeo();
      const fichas = await deps.productos.fichasActivas({ tope: 4000 });
      const porCodigo = new Map<string, { codigo: string; nombre: string; marca: string | null }>();
      for (const f of fichas) {
        if (!f.codigo || porCodigo.has(f.codigo)) continue;
        porCodigo.set(f.codigo, { codigo: f.codigo, nombre: f.nombre, marca: detectarMarca(f.nombre)?.slug ?? null });
      }
      const todos = [...porCodigo.values()];
      const tope = fichas.length >= 4000 ? " (el catálogo tiene más de 4.000 fichas: el conteo es parcial)" : "";
      if (!a.marca) {
        const cuenta = new Map<string, number>();
        for (const p of todos) if (p.marca) cuenta.set(p.marca, (cuenta.get(p.marca) ?? 0) + 1);
        const sin = todos.filter((p) => !p.marca).length;
        const lineas = MARCAS.map((m) => ({ m, n: cuenta.get(m.slug) ?? 0 })).filter((x) => x.n > 0).sort((x, y) => y.n - x.n).map((x) => `- ${x.m.nombre} (${x.m.slug}): ${x.n}`);
        return {
          texto: `Productos activos por código: ${todos.length}${tope}. Con marca reconocida: ${todos.length - sin}. Sin marca: ${sin} (es normal: muchos son productos genéricos).\n${lineas.join("\n")}\nLa marca sale del nombre del producto; no hay campo de marca ni páginas de marca en la tienda.`,
          datos: { productos: todos.length, sinMarca: sin, marcas: lineas.length },
        };
      }
      const objetivo = a.marca.toLowerCase();
      const lista = objetivo === "ninguna" ? todos.filter((p) => !p.marca) : (() => {
        if (!marcaPorSlug(objetivo)) throw new ErrorGestion(`No reconozco la marca «${objetivo}». Mira los slugs sin parámetros, o usa «ninguna».`);
        return todos.filter((p) => p.marca === objetivo);
      })();
      return {
        texto: `${objetivo === "ninguna" ? "Sin marca reconocida" : `Marca ${objetivo}`}: ${lista.length} productos${tope}. Primeros ${Math.min(40, lista.length)}:\n${lista.slice(0, 40).map((p) => `- ${p.codigo} · ${p.nombre}`).join("\n")}`,
        datos: { total: lista.length },
      };
    }),
});
