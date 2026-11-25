// aviso-servidor.ts importa 'server-only' y Resend (no cargan en node --test). Para probar el HTML del correo se reevalúa
// el archivo sin esas importaciones (mismo método que correo-aprobacion-sin-servidor.mjs).
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let fuente = readFileSync(path.join(raiz, "src/lib/mcp/aviso-servidor.ts"), "utf8");
fuente = fuente
  .replace('import "server-only";', "")
  .replace(/import \{ escapeHtml, renderButton, renderEmailLayout, transporter \} from "@jurmaq\/shared\/mail\/email";/,
    `const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const renderButton = ({ href, label }) => '<a href="' + escapeHtml(href) + '">' + escapeHtml(label) + "</a>";
const renderEmailLayout = ({ bodyHtml }) => "<html><body>" + bodyHtml + "</body></html>";
const transporter = { sendMail: async () => ({}) };`)
  .replace('import type { CorreoAviso, DepsAviso } from "./aviso-operacion.ts";', "")
  .replace('import { baseCanonica } from "./config.ts";', `const baseCanonica = () => "https://barraca.jurmaq.cl";`)
  .replace(/\(c: CorreoAviso\)/g, "(c)")
  .replace(/: string \{/g, " {")
  .replace(/\(\): DepsAviso/g, "()")
  .replace(/async enviar\(c\)/g, "async enviar(c)");
const dir = mkdtempSync(path.join(tmpdir(), "aviso-srv-"));
const archivo = path.join(dir, "aviso.ts");
writeFileSync(archivo, fuente);
const m = await import(pathToFileURL(archivo).href);
rmSync(dir, { recursive: true, force: true });
export const htmlCorreoAviso = m.htmlCorreoAviso;
