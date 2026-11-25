// Embebe los textos legales (src/content/legal/*.md) en un módulo TypeScript.
// Por qué: la página de términos y privacidad ahora se regenera en el Worker
// (ISR) para mostrar lo publicado en D1, y ahí no hay sistema de archivos del
// proyecto. El .md sigue siendo la fuente; este archivo se genera.
//   node scripts/generar-legal.mjs           escribe src/lib/contenido/legal-embebido.ts
//   node scripts/generar-legal.mjs --check   falla si el generado no calza con los .md
// `npm run build` lo corre antes de next build.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const salida = path.join(raiz, "src/lib/contenido/legal-embebido.ts");

export function generar() {
  const leer = (n) => readFileSync(path.join(raiz, "src/content/legal", `${n}.md`), "utf8");
  return [
    "// GENERADO por scripts/generar-legal.mjs desde src/content/legal/*.md. No editar a mano.",
    "// Editar el .md y correr `node scripts/generar-legal.mjs` (el build lo hace solo).",
    `export const TERMINOS_MD: string = ${JSON.stringify(leer("terminos"))};`,
    `export const PRIVACIDAD_MD: string = ${JSON.stringify(leer("privacidad"))};`,
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const contenido = generar();
  if (process.argv.includes("--check")) {
    const actual = existsSync(salida) ? readFileSync(salida, "utf8") : "";
    if (actual !== contenido) {
      console.error("legal-embebido.ts no calza con src/content/legal/*.md. Corre: node scripts/generar-legal.mjs");
      process.exit(1);
    }
  } else {
    writeFileSync(salida, contenido);
  }
}
