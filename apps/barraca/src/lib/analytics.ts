/**
 * Analytics tracking helpers tipados para JURMAQ.
 *
 * Wrappea gtag para que los events de conversion estén estandarizados
 * y typesafe. Si NEXT_PUBLIC_GA_MEASUREMENT_ID no está configurado,
 * los events no hacen nada (no rompen la app, solo se pierden — ideal
 * para dev y previews).
 *
 * Convenciones GA4 (no Universal Analytics):
 *  - event names en snake_case predefinidos por Google cuando aplique
 *    (`add_to_cart`, `view_item`, `begin_checkout`, `purchase`, `sign_up`,
 *    `login`) — esos generan reportes automáticos en GA4.
 *  - custom events para JURMAQ-specific (`mejora_precio_request`, etc.)
 *
 * Uso típico:
 *   import { track } from '@/lib/analytics';
 *   track('add_to_cart', { currency: 'CLP', value: 12500, items: [...] });
 */

type GtagEventParams = Record<string, unknown>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/** True solo en cliente con GA configurado. */
function gtagAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function' && !!GA_ID;
}

/**
 * Eventos estandarizados GA4 para e-commerce. Si necesitas un evento
 * custom no listado, usa `trackCustom`.
 */
export type Ga4Event =
  | 'page_view'
  | 'view_item'
  | 'view_item_list'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'view_cart'
  | 'begin_checkout'
  | 'add_payment_info'
  | 'purchase'
  | 'sign_up'
  | 'login'
  | 'search'
  | 'generate_lead';

export function track(event: Ga4Event, params?: GtagEventParams): void {
  if (!gtagAvailable()) return;
  window.gtag!('event', event, params || {});
}

/**
 * Custom event (no GA4-predefinido). Usar para acciones JURMAQ-specific
 * que queremos medir aparte: "mejora_precio_request", "cotizacion_aceptada", etc.
 */
export function trackCustom(eventName: string, params?: GtagEventParams): void {
  if (!gtagAvailable()) return;
  if (!/^[a-z0-9_]{1,40}$/i.test(eventName)) {
    console.warn('[analytics] event name inválido (snake_case alfanumérico ≤40):', eventName);
    return;
  }
  window.gtag!('event', eventName, params || {});
}

/**
 * Helpers semánticos para los flows clave de JURMAQ.
 * Centralizar la forma evita drift de nombres entre componentes.
 */

interface ItemBarraca {
  id: string | number;
  nombre: string;
  precio: number;
  cantidad: number;
  categoria?: string;
}

const CURRENCY = 'CLP';

function toGa4Item(it: ItemBarraca, position?: number) {
  return {
    item_id: String(it.id),
    item_name: it.nombre,
    item_category: it.categoria,
    price: it.precio,
    quantity: it.cantidad,
    ...(position != null ? { index: position } : {}),
  };
}

export const trackEvents = {
  viewItem(item: ItemBarraca) {
    track('view_item', {
      currency: CURRENCY,
      value: item.precio * item.cantidad,
      items: [toGa4Item(item)],
    });
  },
  addToCart(item: ItemBarraca) {
    track('add_to_cart', {
      currency: CURRENCY,
      value: item.precio * item.cantidad,
      items: [toGa4Item(item)],
    });
  },
  removeFromCart(item: ItemBarraca) {
    track('remove_from_cart', {
      currency: CURRENCY,
      value: item.precio * item.cantidad,
      items: [toGa4Item(item)],
    });
  },
  viewCart(items: ItemBarraca[]) {
    const value = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    track('view_cart', {
      currency: CURRENCY,
      value,
      items: items.map((it, idx) => toGa4Item(it, idx)),
    });
  },
  beginCheckout(items: ItemBarraca[]) {
    const value = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    track('begin_checkout', {
      currency: CURRENCY,
      value,
      items: items.map((it, idx) => toGa4Item(it, idx)),
    });
  },
  generateLead(formType: 'cotizacion' | 'contacto' | 'mejora_precio', value?: number) {
    track('generate_lead', {
      currency: CURRENCY,
      value: value ?? 0,
      form_type: formType,
    });
  },
  signUp(method: 'email' | 'google') {
    track('sign_up', { method });
  },
  login(method: 'email' | 'google') {
    track('login', { method });
  },
  search(searchTerm: string) {
    track('search', { search_term: searchTerm });
  },
  // Custom JURMAQ events
  mejoraPrecioUpload(items: number, totalEstimado?: number) {
    trackCustom('mejora_precio_upload', {
      items,
      currency: CURRENCY,
      value: totalEstimado ?? 0,
    });
  },
  contraofertaAcepted(numero: string, totalAhorro: number) {
    trackCustom('contraoferta_aceptada', {
      numero,
      currency: CURRENCY,
      value: totalAhorro,
    });
  },
  /**
   * Conversion principal del e-commerce. Disparar en /pago/exito cuando
   * la cotización confirma estado='pagada' tras el webhook MP.
   *
   * Importante: deduplicar por transaction_id en sessionStorage para no
   * doble-contar si el usuario refresca la página de éxito (esto le
   * inflaría la métrica en GA4 — Google ya hace dedup pero por evento,
   * no por transaction).
   */
  purchase(numero: string, total: number, items: ItemBarraca[]) {
    if (typeof window === 'undefined') return;
    const key = `ga4_purchase_${numero}`;
    if (sessionStorage.getItem(key)) return; // ya enviado en esta sesión
    sessionStorage.setItem(key, '1');
    track('purchase', {
      transaction_id: numero,
      currency: CURRENCY,
      value: total,
      items: items.map((it, idx) => toGa4Item(it, idx)),
    });
  },
  whatsappClick(source: string) {
    trackCustom('whatsapp_click', { source });
  },
};
