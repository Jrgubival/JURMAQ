/**
 * Render an HTML string into a PDF buffer using headless Chromium.
 *
 * Usa Cloudflare Browser Rendering (binding BROWSER en wrangler.jsonc): el
 * Chromium corre en Cloudflare, no dentro del Worker. Si falla, el correo cae
 * al enlace de descarga (ver signed-contract-email.ts).
 *
 * This is server-only code. Never import from a "use client" file.
 */
import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  // Lazy import — only load when actually generating a PDF.
  const { default: puppeteer } = await import('@cloudflare/puppeteer');
  const { env } = await getCloudflareContext({ async: true });

  const browser = await puppeteer.launch((env as unknown as { BROWSER: Parameters<typeof puppeteer.launch>[0] }).BROWSER);

  try {
    const page = await browser.newPage();
    // Use `setContent` instead of navigating — we already have the HTML.
    // `waitUntil: 'networkidle0'` so any external assets (logo, CSS) load
    // before we snapshot.
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });

    // Render. Letter format works fine for A4-ish content; the contract
    // template uses CSS that adapts.
    const pdfBytes: Uint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
    });

    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}
