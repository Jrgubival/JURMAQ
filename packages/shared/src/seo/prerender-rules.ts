/**
 * Speculation Rules para prerender hover-based en Chromium.
 * Colapsa LCP percibido a ~0ms en navegaciones probables.
 *
 * Excluye paths con side-effects (transaccionales, autenticados, mutaciones).
 *
 * @see https://developer.chrome.com/docs/web-platform/prerender-pages
 */
export interface PrerenderRules {
  prerender: {
    where: {
      and: ({ href_matches: string } | { not: { href_matches: string[] } })[];
    };
    eagerness: 'immediate' | 'eager' | 'moderate' | 'conservative';
  }[];
}

/**
 * Paths excluidos del prerender para Constructora (jurmaq.cl).
 * Mantener sincronizado con `apps/constructora/src/app/layout.tsx`.
 */
export const CONSTRUCTORA_PRERENDER_EXCLUDES = [
  '/admin/*',
  '/cuenta/*',
  '/contrato/*',
  '/api/*',
  '/login',
  '/login/*',
];

/**
 * Paths excluidos del prerender para Barraca (barraca.jurmaq.cl).
 */
export const BARRACA_PRERENDER_EXCLUDES = [
  '/admin/*',
  '/cuenta/*',
  '/carrito',
  '/carrito/*',
  '/cotizar',
  '/cotizar/*',
  '/pago/*',
  '/api/*',
  '/login',
  '/login/*',
];

/**
 * Construye el JSON `<script type="speculationrules">` para una app.
 *
 * Uso en root layout:
 *   <script
 *     type="speculationrules"
 *     dangerouslySetInnerHTML={{
 *       __html: JSON.stringify(buildPrerenderRules(CONSTRUCTORA_PRERENDER_EXCLUDES))
 *     }}
 *   />
 */
export function buildPrerenderRules(excludes: string[]): PrerenderRules {
  return {
    prerender: [
      {
        where: {
          and: [
            { href_matches: '/*' },
            { not: { href_matches: excludes } },
          ],
        },
        eagerness: 'moderate',
      },
    ],
  };
}
