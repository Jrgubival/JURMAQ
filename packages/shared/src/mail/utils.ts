/**
 * Helpers compartidos por todos los templates de email.
 */

export { formatCLP } from '../format';

/**
 * Escape HTML entities to prevent injection when interpolating user-controlled
 * strings into email template HTML. Mail clients DO render HTML, so any
 * `<script>` or `<style>` in a client-submitted name/notes/etc. would render
 * unless escaped here. Used by every template that interpolates `${data.xxx}`
 * inside HTML attribute values or text nodes.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Teléfono chileno a formato internacional sin signos (56912345678) para wa.me.
 * Devuelve null si no calza con un celular o fijo chileno razonable.
 */
export function telefonoWhatsApp(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  d = d.replace(/^0+/, '');
  if (d.startsWith('56') && d.length === 11) return d;
  if (d.length === 9) return `56${d}`;
  if (d.length === 8) return `569${d}`;
  return null;
}
