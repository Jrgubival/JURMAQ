/**
 * Lógica pura del aviso de "ventas online" (components/barraca/AvisoVentasOnline.tsx).
 * Sin React ni acceso al navegador, para poder probarla sola
 * (scripts/aviso-promo.test.mjs).
 */

/** Primer instante SIN aviso: 02-12-2026 00:00 en Chile (en diciembre rige UTC-3). */
export const FIN_AVISO_MS = Date.parse("2026-12-02T03:00:00Z");

/** Dónde se guarda el cierre (timestamp en ms) y cuánto dura. */
export const CLAVE_CIERRE = "barraca_aviso_ventas_online";
export const DURACION_CIERRE_MS = 7 * 24 * 60 * 60 * 1000;

/** Clave que escribe el aviso de cookies (packages/shared/src/ui/CookieBanner.tsx). */
export const CLAVE_COOKIES = "consent_v2";

/**
 * Rutas donde el aviso nunca sale: compra y pago, enlaces personales con
 * token (pedido, opinión, cotización, baja), acceso y panel, y lo que no es
 * una página de la tienda. /cuenta existe sólo como redirección a "/".
 */
export const PREFIJOS_SIN_AVISO = [
  "/admin",
  "/api",
  "/login",
  "/cuenta",
  "/carrito",
  "/checkout",
  "/pago",
  "/pedido",
  "/opinar",
  "/baja",
  "/cotizacion",
  "/cotizar",
  "/feeds",
] as const;

export function rutaSinAviso(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return PREFIJOS_SIN_AVISO.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function avisoVigente(ahoraMs: number): boolean {
  return ahoraMs < FIN_AVISO_MS;
}

/** ¿El cierre guardado sigue valiendo? Un valor ilegible o del futuro no vale. */
export function cierreVigente(guardado: string | null, ahoraMs: number): boolean {
  if (!guardado) return false;
  const t = Number(guardado);
  if (!Number.isFinite(t) || t > ahoraMs) return false;
  return ahoraMs - t < DURACION_CIERRE_MS;
}

/**
 * ¿El aviso de cookies está (o estará) abierto? Misma regla que CookieBanner:
 * se muestra mientras no haya una elección guardada y válida (`v: 1`).
 * Sin localStorage (valor null por error de lectura) también cuenta como abierto.
 */
export function cookiesPendientes(guardado: string | null): boolean {
  if (!guardado) return true;
  try {
    return JSON.parse(guardado)?.v !== 1;
  } catch {
    return true;
  }
}
