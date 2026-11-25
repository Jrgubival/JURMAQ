// Permite que node --test cargue módulos que importan @jurmaq/shared/<ruta>
// (packages/shared/src/<ruta>.ts) y los imports sin extensión de ese paquete.
// Uso: import "./pruebas/cargar-shared.mjs" ANTES de importar el módulo a probar.
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const shared = path.join(raiz, "packages/shared/src");

function probar(base) {
  for (const ext of [".ts", "/index.ts", ".tsx", "/index.tsx"]) {
    if (existsSync(base + ext)) return pathToFileURL(base + ext).href;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@jurmaq/shared/")) {
      const url = probar(path.join(shared, specifier.slice("@jurmaq/shared/".length)));
      if (url) return { url, shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL?.includes("/packages/shared/") && !/\.(?:[mc]?[jt]sx?|json)$/.test(specifier)) {
      const url = probar(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier));
      if (url) return { url, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
