/**
 * Helper para armar URLs de WhatsApp con UTM tracking + mensaje pre-formateado.
 *
 * Centralizar acá garantiza:
 *   - Todos los CTAs WhatsApp llevan UTM (medible en GA4 + Search Console)
 *   - Mensaje pre-formateado consistente para que el equipo de soporte
 *     identifique de dónde vino el lead
 *   - Cambio futuro del número (rebrand, otra línea) en un solo lugar
 *   - Saludo canonical: `SALUDO` ("Hola, ") — cambiar acá afecta TODOS los CTAs
 *
 * NUNCA hardcodear `https://wa.me/...?text=...` en componentes — usar siempre
 * `buildWhatsappUrl()` o una de las funciones específicas exportadas abajo.
 */

import { HQ } from '../seo';

// DEFAULT_PHONE viene del canonical HQ.whatsapp (Av. Poniente 2157 line).
// HQ.whatsapp es "https://wa.me/56976673577" — extraemos solo el número.
const DEFAULT_PHONE = HQ.whatsapp.replace('https://wa.me/', '');

/** Saludo canonical para todos los CTAs. Cambiar acá → afecta todos los textos. */
export const SALUDO = 'Hola, ';

export interface WhatsappCtaOpts {
  /** Texto a pre-rellenar en el chat. Si no se provee, no se incluye `text=`. */
  text?: string;
  /** UTM source — default 'jurmaq'. */
  utm_source?: string;
  /** UTM medium — default 'wa'. */
  utm_medium?: string;
  /** UTM content — granularidad del CTA (ej "maquinaria_42_curico", "home_hero"). */
  utm_content?: string;
  /** UTM campaign — campaña específica si aplica. */
  utm_campaign?: string;
  /** Override de número (raro; default JURMAQ contacto). */
  phone?: string;
}

/**
 * Genera la URL completa wa.me/{phone}?text=...&utm_source=...&utm_medium=...&...
 *
 * Notar: WhatsApp ignora los params utm_* (no los reenvía), pero quedan en
 * el referer hacia jurmaq.cl si el cliente vuelve, y nuestro JS los lee del
 * URL inicial para tracking.
 */
export function buildWhatsappUrl(opts: WhatsappCtaOpts = {}): string {
  const phone = opts.phone || DEFAULT_PHONE;
  const params = new URLSearchParams();
  if (opts.text) params.set('text', opts.text);
  params.set('utm_source', opts.utm_source || 'jurmaq');
  params.set('utm_medium', opts.utm_medium || 'wa');
  if (opts.utm_content) params.set('utm_content', opts.utm_content);
  if (opts.utm_campaign) params.set('utm_campaign', opts.utm_campaign);
  return `https://wa.me/${phone}?${params.toString()}`;
}

// ============================================================================
// Constructora — arriendo
// ============================================================================

/** Variante "maquinaria detail": mensaje específico + utm_content de la máquina. */
export function whatsappCtaMaquinaria(maquinariaId: number | string, nombre: string): string {
  return buildWhatsappUrl({
    text: `${SALUDO}me interesa arrendar: ${nombre}`,
    utm_content: `maquinaria_${maquinariaId}`,
    utm_campaign: 'arriendo_detail',
  });
}

/** Variante "ciudad landing SEO": mensaje + utm_content con la ciudad. */
export function whatsappCtaCiudad(ciudadSlug: string, ciudadNombre: string): string {
  return buildWhatsappUrl({
    text: `${SALUDO}necesito cotizar maquinaria en ${ciudadNombre}`,
    utm_content: `ciudad_${ciudadSlug}`,
    utm_campaign: 'arriendo_ciudad',
  });
}

/** Variante "tipo landing SEO": mensaje + utm_content con el tipo. */
export function whatsappCtaTipo(tipoSlug: string, tipoNombre: string): string {
  return buildWhatsappUrl({
    text: `${SALUDO}quiero cotizar arriendo de ${tipoNombre}`,
    utm_content: `tipo_${tipoSlug}`,
    utm_campaign: 'arriendo_tipo',
  });
}

/**
 * Tier 7 G1: cross landing ciudad × tipo. Mensaje específico para que el
 * equipo sepa de inmediato qué ciudad + qué máquina cotizar al recibir
 * el WhatsApp.
 */
export function whatsappCtaCiudadTipo(
  ciudadSlug: string,
  ciudadNombre: string,
  tipoSlug: string,
  tipoNombre: string,
): string {
  return buildWhatsappUrl({
    text: `${SALUDO}necesito ${tipoNombre.toLowerCase()} en arriendo para ${ciudadNombre}`,
    utm_content: `ciudad_${ciudadSlug}_tipo_${tipoSlug}`,
    utm_campaign: 'arriendo_cross_landing',
  });
}

// ============================================================================
// Constructora — landing / contacto
// ============================================================================

/** Variante "homepage hero": genérica. */
export function whatsappCtaHome(): string {
  return buildWhatsappUrl({
    text: `${SALUDO}necesito información sobre JURMAQ`,
    utm_content: 'home_hero',
    utm_campaign: 'home',
  });
}

/** Variante "contacto general": página /contacto u otros lugares similares. */
export function whatsappCtaContacto(): string {
  return buildWhatsappUrl({
    text: `${SALUDO}tengo una consulta`,
    utm_content: 'contacto',
    utm_campaign: 'soporte',
  });
}

// ============================================================================
// Constructora — obra completa
// ============================================================================

/**
 * CTA para landing /obras-completas. Variant:
 *   - 'personalizado' → "quiero precio personalizado para una obra completa"
 *   - 'precio'        → "quiero precio de obra completa"
 * Source: en qué slot del template está el CTA (hero, footer, cta-block, etc.).
 */
export function whatsappCtaObraCompleta(
  variant: 'personalizado' | 'precio' = 'precio',
  source: string = 'cta',
): string {
  const text =
    variant === 'personalizado'
      ? `${SALUDO}quiero precio personalizado para una obra completa`
      : `${SALUDO}quiero precio de obra completa`;
  return buildWhatsappUrl({
    text,
    utm_source: 'site',
    utm_medium: 'cta',
    utm_content: source,
    utm_campaign: 'obra_completa',
  });
}

// ============================================================================
// Barraca — cotizar
// ============================================================================

/**
 * CTA "cotizar X" desde landing/shell/slider de barraca. Scope identifica
 * la copia visible (cotizar materiales / productos / productos-barraca).
 */
export function whatsappCtaBarracaCotizar(
  scope: 'materiales' | 'productos' | 'productos-barraca' = 'productos',
  source: string = 'shell',
): string {
  const map: Record<typeof scope, string> = {
    materiales: 'necesito cotizar materiales',
    productos: 'necesito cotizar productos',
    'productos-barraca': 'necesito cotizar productos de la barraca',
  };
  return buildWhatsappUrl({
    text: `${SALUDO}${map[scope]}`,
    utm_content: `barraca_${source}`,
    utm_campaign: 'barraca_cotizar',
  });
}

/** Cotizar producto puntual desde su detail page. */
export function whatsappCtaProducto(
  productoSlug: string,
  productoNombre: string,
  cantidad: number = 1,
): string {
  const qty = cantidad > 1 ? ` (x${cantidad})` : '';
  return buildWhatsappUrl({
    text: `${SALUDO}quiero cotizar: ${productoNombre}${qty}`,
    utm_content: `producto_${productoSlug}`,
    utm_campaign: 'barraca_producto',
  });
}

// ============================================================================
// Barraca — cotización (post-emisión)
// ============================================================================

/**
 * CTA "consultar sobre cotización existente". Lo usa el cliente desde el
 * email de cotización o desde /cotizacion/[numero].
 */
export function whatsappCtaConsultaCotizacion(numero: string, app: 'barraca' | 'constructora' = 'barraca'): string {
  return buildWhatsappUrl({
    text: `${SALUDO}tengo una consulta sobre la cotización ${numero}`,
    utm_content: `cotizacion_consulta_${numero}`,
    utm_campaign: `${app}_cotizacion`,
  });
}

/** CTA confirmación post-envío (cliente acaba de enviar la cotización). */
export function whatsappCtaCotizacionEnviada(numero: string): string {
  return buildWhatsappUrl({
    text: `${SALUDO}acabo de enviar la cotización ${numero}. Quedo atento a la confirmación.`,
    utm_content: `cotizacion_enviada_${numero}`,
    utm_campaign: 'barraca_cotizacion_enviada',
  });
}

// ============================================================================
// Barraca — maestros y sucursales
// ============================================================================

/**
 * CTA programa maestros. Variant:
 *   - 'registro' → "quiero registrarme como maestro de JURMAQ"
 *   - 'primer'   → "quiero ser el primer maestro JURMAQ" (early-access landing)
 */
export function whatsappCtaMaestro(variant: 'registro' | 'primer' = 'registro'): string {
  const text =
    variant === 'primer'
      ? `${SALUDO}quiero ser el primer maestro JURMAQ`
      : `${SALUDO}quiero registrarme como maestro de JURMAQ`;
  return buildWhatsappUrl({
    text,
    utm_content: `maestro_${variant}`,
    utm_campaign: 'maestros',
  });
}

/** CTA para sucursal específica (acepta override de número si la sucursal tiene WhatsApp propio). */
export function whatsappCtaSucursal(
  ciudad: string,
  opts: { phone?: string; slug?: string } = {},
): string {
  return buildWhatsappUrl({
    text: `${SALUDO}consulto por la sucursal ${ciudad}`,
    utm_content: `sucursal_${opts.slug || ciudad.toLowerCase()}`,
    utm_campaign: 'sucursales',
    phone: opts.phone,
  });
}

// ============================================================================
// Misceláneos
// ============================================================================

/** CTA para roadmap / "tengo una idea". */
export function whatsappCtaIdea(): string {
  return buildWhatsappUrl({
    text: `${SALUDO}tengo una idea para la web de JURMAQ`,
    utm_content: 'roadmap',
    utm_campaign: 'roadmap',
  });
}

/**
 * Share button — wa.me sin número específico (WhatsApp pregunta al usuario
 * a quién enviar). Para compartir productos / páginas con amigos.
 */
export function whatsappShare(text: string): string {
  const params = new URLSearchParams();
  params.set('text', text);
  return `https://wa.me/?${params.toString()}`;
}
