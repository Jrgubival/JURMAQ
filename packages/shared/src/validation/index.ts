/**
 * Esquemas Zod reutilizables + helper para validar bodies de requests.
 *
 * SECURITY (audit jun-2026, capa preventiva): los endpoints públicos validaban
 * a mano con checks ad-hoc, lo que dejaba huecos (p. ej. `Number()` acepta NaN,
 * que evade `<`/`>`). Centralizar la validación en Zod hace que el camino seguro
 * sea el default: parsear el body con un esquema antes de tocarlo.
 *
 * Uso:
 *   import { z, parseBody, clpAmount, isoDate } from '@jurmaq/shared/validation';
 *   const Schema = z.object({ unidades: z.number().int().positive(), fecha: isoDate });
 *   const parsed = parseBody(Schema, await request.json().catch(() => null));
 *   if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
 *   const { unidades, fecha } = parsed.data;
 */
import { z } from 'zod';

export { z };

/** String acotado y trimmeado (texto libre de usuario). */
export const safeText = (max = 500) =>
  z.string().trim().min(1).max(max);

/** Email válido, normalizado a minúsculas. */
export const email = z.string().trim().toLowerCase().email();

/** Entero positivo finito (rechaza NaN/Infinity, que evaden comparaciones). */
export const positiveInt = z.number().int().positive().finite();

/** Entero no negativo finito. */
export const nonNegativeInt = z.number().int().nonnegative().finite();

/** Monto en CLP: entero no negativo, con tope defensivo configurable. */
export const clpAmount = (max = 100_000_000) =>
  z.number().finite().int().min(0).max(max);

/** Fecha ISO `YYYY-MM-DD`. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD');

/** RUT chileno (formato flexible; la validación de dígito verificador va aparte). */
export const rut = z.string().trim().min(7).max(13);

/** Teléfono (E.164 laxo). */
export const phone = z.string().trim().min(8).max(20);

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Valida `body` contra `schema`. Devuelve un mensaje de error compacto y seguro
 * (sin filtrar el body crudo ni stack traces). Pensado para usar directo en el
 * route handler y responder 400 si `ok === false`.
 */
export function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  const path = first?.path?.join('.') ?? '';
  const msg = first?.message ?? 'entrada inválida';
  return { ok: false, error: path ? `${path}: ${msg}` : msg };
}
