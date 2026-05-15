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
