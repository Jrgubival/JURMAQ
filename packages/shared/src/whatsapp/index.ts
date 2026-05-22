/**
 * Helper para armar URLs de WhatsApp con UTM tracking + mensaje pre-formateado.
 *
 * Centralizar acá garantiza:
 *   - Todos los CTAs WhatsApp llevan UTM (medible en GA4 + Search Console)
 *   - Mensaje pre-formateado consistente para que el equipo de soporte
 *     identifique de dónde vino el lead
 *   - Cambio futuro del número (rebrand, otra línea) en un solo lugar
 */

const DEFAULT_PHONE = '56976673577';

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

/** Variante "maquinaria detail": mensaje específico + utm_content de la máquina. */
export function whatsappCtaMaquinaria(maquinariaId: number | string, nombre: string): string {
  return buildWhatsappUrl({
    text: `Hola, me interesa arrendar: ${nombre}`,
    utm_content: `maquinaria_${maquinariaId}`,
    utm_campaign: 'arriendo_detail',
  });
}

/** Variante "ciudad landing SEO": mensaje + utm_content con la ciudad. */
export function whatsappCtaCiudad(ciudadSlug: string, ciudadNombre: string): string {
  return buildWhatsappUrl({
    text: `Hola, necesito cotizar maquinaria en ${ciudadNombre}`,
    utm_content: `ciudad_${ciudadSlug}`,
    utm_campaign: 'arriendo_ciudad',
  });
}

/** Variante "tipo landing SEO": mensaje + utm_content con el tipo. */
export function whatsappCtaTipo(tipoSlug: string, tipoNombre: string): string {
  return buildWhatsappUrl({
    text: `Hola, quiero cotizar arriendo de ${tipoNombre}`,
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
    text: `Hola, necesito ${tipoNombre.toLowerCase()} en arriendo para ${ciudadNombre}`,
    utm_content: `ciudad_${ciudadSlug}_tipo_${tipoSlug}`,
    utm_campaign: 'arriendo_cross_landing',
  });
}

/** Variante "homepage hero": genérica. */
export function whatsappCtaHome(): string {
  return buildWhatsappUrl({
    text: 'Hola, necesito información sobre JURMAQ',
    utm_content: 'home_hero',
    utm_campaign: 'home',
  });
}

/** Variante "contacto general": página /contacto u otros lugares similares. */
export function whatsappCtaContacto(): string {
  return buildWhatsappUrl({
    text: 'Hola, tengo una consulta',
    utm_content: 'contacto',
    utm_campaign: 'soporte',
  });
}
