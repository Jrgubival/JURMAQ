import crypto from 'crypto';

/**
 * Generador de código OTP de 6 dígitos crypto-random.
 *
 * Centralizamos acá la generación para que ningún lugar de la app cree
 * códigos con Math.random() (predecible) ni los logee accidentalmente.
 * Si querés cambiar a 8 dígitos o letras, este es el único punto a tocar.
 */
export function generateOtpCode(): string {
  const n = crypto.randomInt(0, 1_000_000);
  return String(n).padStart(6, '0');
}

/**
 * Normaliza un teléfono chileno a E.164 (+56XXXXXXXXX).
 * Acepta entradas con espacios, paréntesis, guiones, prefijo '0' opcional.
 */
export function normalizarTelefonoCL(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('56')) return `+${digits}`;
  const sinCero = digits.replace(/^0+/, '');
  return `+56${sinCero}`;
}

export function esEmail(destino: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino);
}
