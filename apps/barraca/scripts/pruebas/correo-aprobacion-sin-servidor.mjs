// El correo real importa 'server-only' y Resend (no cargan en node --test). Para probar la
// plantilla se reevalúa el archivo sin esas dos importaciones.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let fuente = readFileSync(path.join(raiz, "src/lib/mcp/correo-aprobacion.ts"), "utf8");
fuente = fuente
  .replace('import "server-only";', "")
  .replace(/import \{ escapeHtml, renderButton, renderEmailLayout, transporter \} from "@jurmaq\/shared\/mail\/email";/,
    `const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const renderButton = ({ href, label }) => '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + "</a>";
const renderEmailLayout = ({ bodyHtml }) => "<html><body>" + bodyHtml + "</body></html>";
const transporter = { sendMail: async () => ({}) };`)
  .replace('from "./aprobaciones.ts"', `from "${pathToFileURL(path.join(raiz, "src/lib/mcp/aprobaciones.ts")).href}"`);
const dir = mkdtempSync(path.join(tmpdir(), "correo-aprob-"));
const archivo = path.join(dir, "correo.ts");
writeFileSync(archivo, fuente);
const m = await import(pathToFileURL(archivo).href);
rmSync(dir, { recursive: true, force: true });
export const construirCorreoAprobacion = m.construirCorreoAprobacion;
