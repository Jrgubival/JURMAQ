/**
 * SkipLink — WCAG 2.1 SC 2.4.1 (Bypass Blocks).
 *
 * Componente A11y compartido entre constructora y barraca. Permite a usuarios
 * de teclado y lectores de pantalla saltarse el menú/navbar/banners y caer
 * directamente al contenido principal (`#main-content`).
 *
 * Estilo: oculto visualmente hasta recibir foco (Tab desde la barra de URL
 * en cualquier página). Tan pronto como aparece, queda anclado top-left con
 * z-index alto. Color navy con anillo de foco visible.
 *
 * Uso (root layout):
 *   import { SkipLink } from '@jurmaq/shared/a11y/SkipLink';
 *
 *   <body>
 *     <SkipLink />
 *     ...
 *     <main id="main-content">...</main>
 *   </body>
 *
 * El page wrapper debe declarar `id="main-content"` y opcionalmente
 * `tabIndex={-1}` para recibir foco programático sin entrar en tab order.
 */
export function SkipLink({ targetId = "main-content", label = "Ir al contenido principal" }: { targetId?: string; label?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#081428] focus:text-white focus:rounded-lg focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
    >
      {label}
    </a>
  );
}
