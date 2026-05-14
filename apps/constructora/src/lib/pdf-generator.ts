/**
 * Render an HTML string into a PDF buffer using headless Chromium.
 *
 * Why this stack:
 *  - puppeteer-core (no bundled browser, ~3MB) + @sparticuz/chromium-min
 *    (downloads a Vercel-Lambda-compatible Chromium binary on demand) is
 *    the standard way to do HTML→PDF on Vercel serverless functions.
 *  - We import dynamically so the heavy chromium binary is only loaded
 *    when this function is actually called (avoids bundling cost on cold
 *    starts of unrelated routes).
 *
 * Caveats:
 *  - First invocation per cold start downloads ~50MB Chromium → ~5-10s
 *    extra latency. Subsequent calls reuse the cached binary.
 *  - Function memory must be ≥ 1024 MB. Set in vercel.json or via the
 *    `runtime` export of the calling route.
 *  - This is server-only code. Never import from a "use client" file.
 */
import 'server-only';

const CHROMIUM_TAR =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  // Lazy import — only load when actually generating a PDF.
  const [{ default: chromium }, puppeteer] = await Promise.all([
    import('@sparticuz/chromium-min'),
    import('puppeteer-core'),
  ]);

  const browser = await puppeteer.default.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(CHROMIUM_TAR),
    headless: true,
  });

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
