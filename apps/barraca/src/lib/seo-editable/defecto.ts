/**
 * Título y descripción que genera hoy el código, EXACTOS, en un solo lugar.
 * Las páginas de la tienda llaman a estas funciones (no repiten el texto), así
 * que lo que ve Google con D1 vacía o caída es idéntico a lo de siempre, y
 * `ver_seo` / `auditar_seo` muestran exactamente ese texto como «por defecto».
 * Puro (sin Next ni Supabase) para poder probarlo con node --test.
 */
import { formatCLP } from "@jurmaq/shared/format";
import { COBERTURA_CORTA, LUGARES_DESPACHO } from "../cobertura.ts";
import type { PaginaSeo } from "./reglas.ts";

export interface TextosMeta {
  titulo: string;
  descripcion: string;
  ogTitulo?: string;
  ogDescripcion?: string;
}

// ── Producto (por código; el precio sale de la ficha en el momento de generar la página) ──

export interface EntradaMetaProducto {
  nombre: string;
  codigo: string | null | undefined;
  /** ¿Se puede comprar ahora (hay stock y precio)? */
  disponible: boolean;
  /** Lo que se cobra hoy (solo se usa si está disponible). */
  precioFinal: number;
}

export function metaProductoDefecto(p: EntradaMetaProducto): Required<TextosMeta> {
  const precioFormateado = p.disponible ? formatCLP(p.precioFinal) : "No disponible";
  const stockTexto = p.disponible ? "Stock disponible" : "Por ahora no disponible en línea";
  const titlePrecio = p.disponible ? `${precioFormateado} · En stock` : "No disponible";
  return {
    titulo: `${p.nombre} ${titlePrecio} · Barraca JURMAQ Curicó`,
    descripcion: `Compra ${p.nombre} en Barraca JURMAQ, Molina. ${p.disponible ? `Precio web: ${precioFormateado}. ` : ""}${stockTexto}. Retiro en Molina y despacho en camión a Curicó, Talca y alrededores. Código: ${p.codigo}.`,
    ogTitulo: `${p.nombre} - ${titlePrecio} | Barraca JURMAQ`,
    ogDescripcion: `${p.nombre}${p.disponible ? ` a ${precioFormateado}` : ""}. ${stockTexto}. Despacho en Region del Maule.`,
  };
}

// ── Categoría ──

export function metaCategoriaDefecto(c: { nombre: string; total: number }): Required<TextosMeta> {
  const lowerName = c.nombre.toLowerCase();
  return {
    titulo: `${c.nombre} en Molina · Despacho a Curicó y Talca · Barraca JURMAQ`,
    descripcion: `${c.total} productos de ${lowerName} con precio publicado en Barraca JURMAQ Curicó · Molina. ${COBERTURA_CORTA}`,
    ogTitulo: `${c.nombre} · Barraca JURMAQ Curicó · Molina`,
    ogDescripcion: `${c.total} productos de ${lowerName} con precio publicado y stock. ${COBERTURA_CORTA}`,
  };
}

// ── Páginas fijas ──

/** Datos del local que entran en los textos de nosotros, contacto y dónde estamos. */
export interface LocalParaMeta {
  razonSocial: string;
  direccionCorta: string;
  telefonoDisplay: string;
  email: string;
  /** Horario en una frase (p. ej. «Lunes a viernes 8:00 a 18:00»). */
  horarioSemana: string;
}

export const TITULO_SUCURSALES = "Dónde estamos · Barraca en Molina · Despacho a Curicó, Talca y alrededores · JURMAQ";

export function metaPaginaDefecto(id: PaginaSeo, local?: LocalParaMeta): TextosMeta {
  switch (id) {
    case "portada":
      return {
        titulo: "Barraca de Fierros y Materiales · Curicó · JURMAQ",
        descripcion: `Fierro estriado, perfiles, planchas, tubos, mallas Acma, pinturas y materiales de construcción en Barraca JURMAQ Curicó · Molina. Retiro en Molina y despacho en camión a Molina, Curicó, Talca y alrededores.`,
      };
    case "categorias":
      return {
        titulo: "Categorías · Barraca JURMAQ Curicó · Materiales de Construcción Maule",
        descripcion: `Todas las categorías de la Barraca JURMAQ Curicó · Molina: fierros, perfiles, planchas, tubos, mallas Acma, cementos, pinturas, herramientas y más. ${COBERTURA_CORTA}`,
      };
    case "guias":
      return {
        titulo: "Guías de Construcción · Barraca JURMAQ",
        descripcion: "Guías técnicas sobre fierros, mallas, cementos y materiales de construcción. Diferencias, usos y cuándo elegir cada uno. Por barraca JURMAQ Maule.",
      };
    case "calculadora_fierro":
      return {
        titulo: "Calculadora de Fierro para Losa, Muros y Radier · JURMAQ Barraca",
        descripcion: "Calcula cuántos quintales de fierro necesitas para tu obra: losa, sobrelosa, muros de hormigón armado, radier. Cuantías típicas chilenas (kg/m²). Compra en barraca.jurmaq.cl con retiro en Molina o despacho en camión a Molina, Curicó, Talca y alrededores.",
      };
    case "envios":
      return {
        titulo: "Envíos y devoluciones · Barraca JURMAQ",
        descripcion: "Retiro gratis en Molina y despacho en camión propio con tarifa por zona (Molina gratis). Devoluciones dentro de 10 días corridos y reembolsos según los Términos.",
      };
    case "terminos":
      return {
        titulo: "Términos y Condiciones · Barraca JURMAQ",
        descripcion: "Términos y Condiciones de la tienda online de Barraca de Fierros JURMAQ SpA, Molina.",
      };
    case "privacidad":
      return {
        titulo: "Política de Privacidad · Barraca JURMAQ",
        descripcion: "Política de Privacidad de la tienda online de Barraca de Fierros JURMAQ SpA, Molina.",
      };
    case "nosotros": {
      const B = local;
      return {
        titulo: "Quiénes somos · Barraca de Fierros JURMAQ, Molina",
        descripcion: B
          ? `${B.razonSocial}: barraca de fierros y materiales de construcción en ${B.direccionCorta}. Venta en el local y en línea, retiro en Molina y despacho en camión propio.`
          : "",
      };
    }
    case "contacto": {
      const B = local;
      return {
        titulo: "Contacto · Barraca de Fierros JURMAQ, Molina",
        descripcion: B ? `${B.razonSocial} · ${B.direccionCorta}. WhatsApp y teléfono ${B.telefonoDisplay}, correo ${B.email}. ${B.horarioSemana}.` : "",
      };
    }
    case "sucursales": {
      const B = local;
      return {
        titulo: TITULO_SUCURSALES,
        descripcion: B
          ? `Nuestra barraca de fierros está en ${B.direccionCorta}. Retiro en el local y despacho en camión a ${LUGARES_DESPACHO}. Horarios, teléfono y WhatsApp directo.`
          : "",
      };
    }
  }
}

/** Páginas cuyo texto depende de los datos del local. */
export const PAGINAS_CON_LOCAL: ReadonlySet<PaginaSeo> = new Set<PaginaSeo>(["nosotros", "contacto", "sucursales"]);

/** Arma lo que necesitan los textos a partir de la vista del local (`leerLocal()`). */
export function localParaMeta(B: { razonSocial: string; direccionCorta: string; telefonoDisplay: string; email: string; h: { semana: string } }): LocalParaMeta {
  return { razonSocial: B.razonSocial, direccionCorta: B.direccionCorta, telefonoDisplay: B.telefonoDisplay, email: B.email, horarioSemana: B.h.semana };
}
