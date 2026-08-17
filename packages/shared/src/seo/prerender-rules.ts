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
        // `conservative` = solo al apretar el botón del mouse, cuando el
        // usuario ya se comprometió a navegar.
        //
        // Estaba en `moderate`, que prerenderiza tras ~200 ms de hover. En una
        // grilla de catálogo el usuario pasa el mouse por 10-20 fichas antes de
        // hacer click, y cada hover traía la página COMPLETA y además disparaba
        // su revalidación ISR. Con 1.978 productos eso era una de las fuentes
        // principales de invocaciones y de ISR writes en Vercel.
        //
        // La ganancia de LCP percibido se mantiene casi igual —al apretar el
        // botón todavía hay ~100-200 ms antes del mouseup— a una fracción del
        // costo.
        eagerness: 'conservative',
      },
    ],
  };
}
