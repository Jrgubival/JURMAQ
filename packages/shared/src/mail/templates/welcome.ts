import { transporter } from "../transport";
import { renderEmailLayout, renderButton, BRAND } from "../layout";
import { escapeHtml } from "../utils";

const SITE = "https://barraca.jurmaq.cl";

/**
 * Welcome email tras registro de cuenta nueva en barraca.jurmaq.cl.
 * Usa el layout de marca compartido (../layout).
 */
export async function sendWelcomeEmail(to: string, nombre: string) {
  const body = `
    <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.orange};">Te damos la bienvenida</p>
    <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${BRAND.navy};font-weight:800;">Hola ${escapeHtml(nombre)}, tu cuenta está lista</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${BRAND.text};">
      Nos alegra tenerte en JURMAQ Barraca. Ya puedes cotizar materiales de construcción con los mejores precios de la Región del Maule.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f8fa;border:1px solid ${BRAND.border};border-radius:10px;margin-bottom:28px;">
      <tr><td style="padding:18px 22px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:${BRAND.navy};">Con tu cuenta puedes:</p>
        <p style="margin:0;font-size:14px;line-height:2;color:${BRAND.text};">
          &#10003; Ver tus cotizaciones y su estado en tiempo real<br>
          &#10003; Repetir pedidos anteriores con un clic<br>
          &#10003; Guardar productos favoritos<br>
          &#10003; Recibir ofertas y precios especiales
        </p>
      </td></tr>
    </table>
    <div style="margin-bottom:14px;">${renderButton({ href: `${SITE}/categorias`, label: "Explorar el catálogo" })}</div>
    <div class="jm-btn">${renderButton({ href: "https://wa.me/56976673577?text=Hola%2C%20acabo%20de%20crear%20mi%20cuenta%20en%20JURMAQ", label: "Escríbenos por WhatsApp", color: "whatsapp" })}</div>
  `;

  const html = renderEmailLayout({
    title: "Bienvenido a JURMAQ Barraca",
    preheader: `Tu cuenta en JURMAQ Barraca ya está activa, ${nombre}.`,
    bodyHtml: body,
    marketing: true,
  });

  await transporter.sendMail({
    to,
    subject: "Bienvenido a JURMAQ Barraca",
    html,
  });
}
