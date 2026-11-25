// Deja cargar src/lib/pedidos/correos.ts en node --test: reemplaza lo que arrastra servidor
// (server-only, env, Resend, Supabase, enlaces firmados) por piezas falsas de ./stubs-correos y
// resuelve imports relativos sin extensión. El layout y los textos de los correos son los REALES.
// Uso: import "./pruebas/cargar-alias.mjs"; import "./pruebas/cargar-shared.mjs"; import "./pruebas/cargar-correos.mjs";
// y después importar ../src/lib/pedidos/correos.ts. Los correos "enviados" quedan en globalThis.__CORREOS_ENVIADOS__.
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const stub = (n) => pathToFileURL(path.join(aqui, "stubs-correos", n)).href;
const raiz = path.resolve(aqui, "../..");

const PARA_CORREOS = new Map([
  ["server-only", "vacio.mjs"],
  ["@jurmaq/shared/env", "env.mjs"],
  ["@jurmaq/shared/mail/email", "mail-email.mjs"],
  ["@jurmaq/shared/mail/barraca", "mail-barraca.mjs"],
  ["./index", "pedidos-index.mjs"],
  ["./enlace", "enlace.mjs"],
  ["./comprobantes", "comprobantes.mjs"],
  ["./local-correos", "local-correos.mjs"],
]);

registerHooks({
  resolve(specifier, context, next) {
    const padre = context.parentURL ?? "";
    if (padre.endsWith("/src/lib/pedidos/correos.ts") && PARA_CORREOS.has(specifier)) {
      return { url: stub(PARA_CORREOS.get(specifier)), shortCircuit: true };
    }
    // Lo nuevo que importa correos.ts para leer plantillas de D1 (servidor): se reemplaza por una lectura simulada.
    if (padre.endsWith("/src/lib/pedidos/correos.ts") && specifier === "@/lib/correos-cliente/servidor") {
      return { url: stub("correos-servidor.mjs"), shortCircuit: true };
    }
    // Imports relativos sin extensión dentro de la app (solo los que hagan falta).
    if (specifier.startsWith(".") && padre.startsWith(pathToFileURL(path.join(raiz, "src")).href) && !/\.[mc]?[jt]sx?$/.test(specifier)) {
      const base = path.resolve(path.dirname(fileURLToPath(padre)), specifier);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
});
