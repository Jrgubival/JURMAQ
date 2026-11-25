// Permite que node --test cargue módulos de src/ que usan los alias de
// tsconfig (@/ y @jurmaq/shared/supabase) sin tocar servicios reales.
// Uso: import "./pruebas/cargar-alias.mjs" ANTES de importar el módulo a probar.
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const falso = pathToFileURL(path.join(raiz, "scripts/pruebas/supabase-falso.mjs")).href;

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "@jurmaq/shared/supabase") return { url: falso, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const base = path.join(raiz, "src", specifier.slice(2));
      for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
        if (existsSync(base + ext) && (ext || path.extname(base))) {
          return { url: pathToFileURL(base + ext).href, shortCircuit: true };
        }
      }
    }
    return next(specifier, context);
  },
});
