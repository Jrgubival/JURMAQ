/**
 * Enlaces de WhatsApp de la barraca con el número de la fuente única
 * (DatosLocal.whatsapp). Mismo texto y UTM que los helpers de
 * @jurmaq/shared/whatsapp: con el respaldo en código dan la misma URL.
 */
import { buildWhatsappUrl, TEXTO_WA_BARRACA } from "@jurmaq/shared/whatsapp";

export function whatsappCotizar(numero: string, source: string = "shell"): string {
  return buildWhatsappUrl({ text: TEXTO_WA_BARRACA, utm_content: `barraca_${source}`, utm_campaign: "barraca_cotizar", phone: numero });
}

/** Enlace con mensaje propio y el número de la fuente única. */
export function whatsappConTexto(numero: string, texto: string, utm: { content?: string; campaign?: string } = {}): string {
  return buildWhatsappUrl({ text: texto, utm_content: utm.content, utm_campaign: utm.campaign, phone: numero });
}
