import { transporter } from "../transport";

/**
 * Welcome email tras registro de cuenta nueva en barraca.jurmaq.cl.
 */
export async function sendWelcomeEmail(to: string, nombre: string) {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="background-color: #0c1d3a; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">JURMAQ</h1>
              <p style="margin: 4px 0 0; color: #ea580c; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px;">Barraca</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center;">
              <div style="margin-bottom: 20px;">
                <span style="font-size: 48px;">&#128075;</span>
              </div>
              <h2 style="margin: 0 0 12px; color: #0c1d3a; font-size: 22px;">Bienvenido a JURMAQ Barraca</h2>
              <p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Hola <strong>${nombre}</strong>,<br>
                Nos alegra tenerte con nosotros. Tu cuenta ha sido creada exitosamente y ya puedes comenzar a cotizar materiales de construccion con los mejores precios de la Region del Maule.
              </p>

              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: left;">
                <p style="margin: 0 0 12px; color: #0c1d3a; font-size: 15px; font-weight: 600;">Con tu cuenta puedes:</p>
                <p style="margin: 0; color: #374151; font-size: 14px; line-height: 2.2;">
                  &#10003; Ver tus cotizaciones y su estado en tiempo real<br>
                  &#10003; Repetir pedidos anteriores con un click<br>
                  &#10003; Recibir ofertas y precios especiales<br>
                  &#10003; Explorar nuestro catalogo completo de materiales<br>
                  &#10003; Guardar productos favoritos
                </p>
              </div>

              <div style="text-align: center; margin-bottom: 16px;">
                <a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/barraca/categorias" style="display: inline-block; background-color: #ea580c; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  Explorar Categorias
                </a>
              </div>
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="https://wa.me/56976673577?text=Hola%2C%20acabo%20de%20crear%20mi%20cuenta%20en%20JURMAQ" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                  Escribenos por WhatsApp
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; text-align: center;">
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px; line-height: 1.8;">
                Tel: +56 9 7667 3577 | contacto@jurmaq.cl<br>
                Av. Poniente 2157, Molina, Maule, Chile
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; font-style: italic;">
                Mas de 25 anos atendiendo en la Region del Maule
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0c1d3a; padding: 20px 32px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                &copy; ${new Date().getFullYear()} JURMAQ Barraca. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  await transporter.sendMail({
    to,
    subject: "Bienvenido a JURMAQ Barraca",
    html: htmlContent,
  });
}
