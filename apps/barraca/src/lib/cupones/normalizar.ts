import { sha256Hex } from "../gestion/util.ts";

/**
 * Correo normalizado para el control "un uso por cliente": minúsculas, sin
 * "+etiqueta" y, en Gmail, sin puntos (a.b@gmail.com = ab@gmail.com).
 * No hay cuentas de cliente: este control es lo que hay (ver docs/MCP-NOTAS.md).
 */
export function normalizarEmail(email: string): string {
  const e = String(email ?? "").trim().toLowerCase();
  const arroba = e.lastIndexOf("@");
  if (arroba < 1) return e;
  let local = e.slice(0, arroba);
  let dominio = e.slice(arroba + 1);
  const mas = local.indexOf("+");
  if (mas > 0) local = local.slice(0, mas);
  if (dominio === "googlemail.com") dominio = "gmail.com";
  if (dominio === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${dominio}`;
}

/** RUT sin puntos ni guion, dígito verificador en mayúscula y sin ceros a la izquierda. null si no parece un RUT. */
export function normalizarRut(rut: string | null | undefined): string | null {
  const limpio = String(rut ?? "").replace(/[^0-9kK]/g, "").toUpperCase().replace(/^0+/, "");
  return /^\d{6,9}[0-9K]$/.test(limpio) ? limpio : null;
}

function pimienta(): string {
  try {
    return (typeof process !== "undefined" && process.env?.CUPONES_PEPPER) || "";
  } catch {
    return "";
  }
}

/** Huella para guardar en lugar del dato personal. Exige CUPONES_PEPPER (secreto): sin él lanza error y el cupón no se aplica. */
export async function huellaCliente(tipo: "email" | "rut", valorNormalizado: string): Promise<string> {
  const sal = pimienta();
  // Fail-closed: sin la sal secreta un hash de correo o RUT se podría revertir por fuerza bruta.
  if (!sal) throw new Error("falta_pepper");
  return sha256Hex(`cupon:${tipo}:${sal}:${valorNormalizado}`);
}
