/**
 * Fechas de vigencia del contenido (desde/hasta). Funciones puras.
 *
 * Formatos aceptados:
 *   - ISO con zona: "2026-12-02T03:00:00Z" o "2026-12-02T00:00:00-03:00".
 *   - Hora de Chile sin zona: "2026-12-02T00:00" o "2026-12-02 00:00" (se
 *     interpreta en America/Santiago, con horario de verano).
 *   - Solo fecha "2026-12-02": medianoche de Chile de ese día.
 * `desde` es inclusivo y `hasta` es EXCLUSIVO (primer instante sin el contenido),
 * igual que FIN_AVISO_MS del popup actual.
 */

const ZONA = "America/Santiago";

function desfaseChileMs(utcMs: number): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  const comoUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"), g("second"));
  return comoUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "AAAA-MM-DD HH:MM" hora de Chile → ms UTC. */
function chileAMs(a: number, m: number, d: number, h: number, min: number): number | null {
  const base = Date.UTC(a, m - 1, d, h, min);
  const f = new Date(base);
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d || f.getUTCHours() !== h) return null;
  // Dos pasadas resuelven el cambio de horario.
  let ms = base - desfaseChileMs(base);
  ms = base - desfaseChileMs(ms);
  return ms;
}

/** Convierte un texto de fecha a ms UTC, o null si no es válido. */
export function parseFecha(texto: unknown): number | null {
  if (typeof texto !== "string") return null;
  const t = texto.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(t)) {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
  }
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!m) return null;
  return chileAMs(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
}

export interface Vigencia {
  desde: string | null;
  hasta: string | null;
}

/** ¿Está vigente en `ahoraMs`? Sin fechas = siempre. Una fecha ilegible no vale (no se muestra). */
export function vigenteEn(v: Vigencia, ahoraMs: number): boolean {
  if (v.desde) {
    const d = parseFecha(v.desde);
    if (d === null || ahoraMs < d) return false;
  }
  if (v.hasta) {
    const h = parseFecha(v.hasta);
    if (h === null || ahoraMs >= h) return false;
  }
  return true;
}

/** Valida el par desde/hasta: formatos correctos y desde < hasta. Devuelve errores. */
export function validarVigencia(v: Vigencia, campo: string): string[] {
  const errores: string[] = [];
  const d = v.desde ? parseFecha(v.desde) : null;
  const h = v.hasta ? parseFecha(v.hasta) : null;
  if (v.desde && d === null) errores.push(`${campo}: "desde" no es una fecha válida (usa AAAA-MM-DDTHH:MM, hora de Chile).`);
  if (v.hasta && h === null) errores.push(`${campo}: "hasta" no es una fecha válida (usa AAAA-MM-DDTHH:MM, hora de Chile).`);
  if (d !== null && h !== null && d >= h) errores.push(`${campo}: "desde" debe ser anterior a "hasta".`);
  return errores;
}
