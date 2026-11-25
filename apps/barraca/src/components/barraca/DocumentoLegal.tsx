import "server-only";
import type { ReactNode } from "react";
import { leerContenido } from "@/lib/contenido/lectura";
import { enlaceSeguro } from "@/lib/contenido/markdown";

/**
 * Términos y Privacidad: se publican tal cual los redactaron los abogados
 * (src/content/legal/*.md, copia de "02 DOCUMENTOS LEGALES SpA/WEB
 * barraca.jurmaq.cl"). Este lector entiende sólo lo que esos textos usan:
 * títulos, párrafos, listas, tablas, separadores, **negrita** y enlaces.
 *
 * El texto sale del contenido editable (D1, con versiones) y, si no hay nada
 * publicado o D1 falla, de src/content/legal/*.md embebido en el código
 * (lib/contenido/legal-embebido.ts, generado por scripts/generar-legal.mjs).
 * Los enlaces se vuelven a comprobar al pintar (solo https o rutas internas).
 *
 * Las marcas [COMPLETAR …] / [TARIFA …] son datos que el dueño todavía no
 * entregó: se pintan en amarillo y la página muestra un aviso de borrador.
 * Nunca se rellenan con un dato inventado.
 */

const MARCA = /\[(?:COMPLETAR|TARIFA)[^\]]*\]/g;

/** El texto vigente del documento (publicado en D1 o respaldo en código). */
export async function leerDocumento(nombre: "terminos" | "privacidad"): Promise<string> {
  return (await leerContenido(nombre)).texto;
}

export function tieneMarcas(md: string): boolean {
  return new RegExp(MARCA.source).test(md);
}

/** "legal": términos y privacidad. "pagina": nosotros y envíos (mismo estilo que sus páginas). */
export type VarianteTexto = "legal" | "pagina";

function enLinea(texto: string, clave: string, v: VarianteTexto = "legal"): ReactNode[] {
  // Orden: marcas pendientes, enlaces, negritas.
  const tokens = texto.split(/(\[(?:COMPLETAR|TARIFA)[^\]]*\]|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return tokens.filter(Boolean).map((t, i) => {
    const k = `${clave}-${i}`;
    if (/^\[(COMPLETAR|TARIFA)/.test(t)) {
      return <mark key={k} className="bg-amber-100 text-amber-900 rounded px-1">{t}</mark>;
    }
    const enlace = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (enlace) {
      const destino = enlaceSeguro(enlace[2]);
      if (!destino) return enlace[1];
      const externo = /^https?:/.test(destino);
      return (
        <a key={k} href={destino} className={v === "pagina" ? "underline underline-offset-2" : "text-marca-600 underline underline-offset-2"} {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {enlace[1]}
        </a>
      );
    }
    if (t.startsWith("**") && t.endsWith("**")) return v === "pagina" ? <strong key={k}>{t.slice(2, -2)}</strong> : <strong key={k} className="font-semibold text-navy-950">{t.slice(2, -2)}</strong>;
    return t;
  });
}

export function renderizar(md: string, v: VarianteTexto = "legal"): ReactNode[] {
  const lineas = md.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    const k = `b${i}`;
    if (!l.trim()) { i++; continue; }
    if (/^---+\s*$/.test(l)) { out.push(<hr key={k} className="my-8 border-gray-200" />); i++; continue; }
    const h = l.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const nivel = h[1].length;
      const cls = v === "pagina"
        ? (nivel === 1 ? "text-3xl font-bold text-navy-950 mb-6" : nivel === 2 ? "text-xl font-bold text-navy-950 mt-10 mb-3" : "text-base font-bold text-navy-950 mt-6 mb-2")
        : (nivel === 1 ? "text-2xl lg:text-3xl font-extrabold text-navy-950 mb-4" : nivel === 2 ? "text-xl font-bold text-navy-950 mt-10 mb-3 scroll-mt-28" : "text-base font-bold text-navy-950 mt-6 mb-2");
      const id = nivel === 2 ? h[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : undefined;
      const Tag = (`h${nivel}`) as "h1" | "h2" | "h3";
      out.push(<Tag key={k} id={id} className={cls}>{enLinea(h[2], k, v)}</Tag>);
      i++;
      continue;
    }
    if (l.trimStart().startsWith("|")) {
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].trimStart().startsWith("|")) {
        const celdas = lineas[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!celdas.every((c) => /^:?-{3,}:?$/.test(c))) filas.push(celdas);
        i++;
      }
      const [cab, ...cuerpo] = filas;
      out.push(
        <div key={k} className="my-4 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>{cab.map((c, j) => <th key={j} className="px-3 py-2 font-semibold text-navy-950 align-top">{enLinea(c, `${k}h${j}`, v)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cuerpo.map((f, r) => (
                <tr key={r}>{f.map((c, j) => <td key={j} className="px-3 py-2 align-top text-gray-700">{enLinea(c, `${k}r${r}c${j}`, v)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lineas.length && /^\s*[-*]\s+/.test(lineas[i])) {
        items.push(lineas[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={k} className={v === "pagina" ? "list-disc pl-5 space-y-1.5" : "my-3 space-y-1.5 pl-5 list-disc marker:text-gray-400"}>
          {items.map((t, j) => <li key={j}>{enLinea(t, `${k}-${j}`, v)}</li>)}
        </ul>,
      );
      continue;
    }
    // Párrafo: junta líneas seguidas hasta una en blanco o un bloque nuevo.
    const partes: string[] = [];
    while (i < lineas.length && lineas[i].trim() && !/^(#{1,3}\s|---|\s*[-*]\s|\s*\|)/.test(lineas[i])) {
      partes.push(lineas[i].trim());
      i++;
    }
    out.push(<p key={k} className={v === "pagina" ? "mb-4" : "my-3"}>{enLinea(partes.join(" "), k, v)}</p>);
  }
  return out;
}

export default async function DocumentoLegal({ nombre }: { nombre: "terminos" | "privacidad" }) {
  const md = await leerDocumento(nombre);
  const borrador = tieneMarcas(md);
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      {borrador && (
        <div role="note" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-semibold">Borrador.</strong> Este documento todavía tiene datos por completar (marcados en amarillo). No es la versión final.
        </div>
      )}
      <article className="text-[15px] leading-relaxed text-gray-700">{renderizar(md)}</article>
      <p className="mt-10 text-sm text-gray-500 print:hidden">
        Puedes guardar o imprimir esta página con la opción de imprimir de tu navegador.
      </p>
    </div>
  );
}
