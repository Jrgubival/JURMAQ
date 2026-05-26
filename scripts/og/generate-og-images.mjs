#!/usr/bin/env node
/**
 * Genera 2 OG images estáticas (1200×630 PNG) para constructora y barraca.
 *
 * Uso: node scripts/og/generate-og-images.mjs
 *
 * Stack: Chrome headless CLI + pngquant para compresión lossy (color
 * quantization a 8-bit). No usa puppeteer porque pnpm hoisting + procesos
 * paralelos (next build) producen require() hangs.
 *
 * Requiere:
 *   - Google Chrome instalado en /Applications
 *   - pngquant en PATH (`brew install pngquant`); si falta, salta el paso
 *     de compresión y avisa al final.
 *
 * Outputs:
 *   apps/constructora/public/og-image-1200x630.png
 *   apps/barraca/public/og-image-barraca-1200x630.png
 */
import { readFile, writeFile, stat, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const CHROME_PATH =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const FONT_LINK = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:wght@500&family=Geist:wght@400;600&display=block" rel="stylesheet">
`;

async function toDataUri(absPath) {
  const buf = await readFile(absPath);
  const ext = absPath.split('.').pop().toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function constructoraHtml(heroDataUri) {
  return `<!doctype html>
<html lang="es-CL">
<head>
  <meta charset="utf-8">
  ${FONT_LINK}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1200px; height: 630px; overflow: hidden; }
    body {
      position: relative;
      background: #0c1d3a url('${heroDataUri}') center/cover no-repeat;
      font-family: 'Geist', -apple-system, sans-serif;
      color: #fff;
    }
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(135deg,
        rgba(12,29,58,0.92) 0%,
        rgba(12,29,58,0.55) 50%,
        rgba(12,29,58,0.20) 100%);
    }
    .frame {
      position: absolute; inset: 0;
      padding: 64px;
      display: flex; flex-direction: column; justify-content: space-between;
    }
    .eyebrow {
      font-size: 13px; font-weight: 600;
      letter-spacing: 0.18em; text-transform: uppercase;
      color: #e6b422;
    }
    .stack { display: flex; flex-direction: column; align-items: flex-start; }
    .headline {
      font-family: 'Newsreader', Georgia, serif;
      font-weight: 500;
      font-size: 72px;
      line-height: 1.02;
      letter-spacing: -0.025em;
      color: #ffffff;
      max-width: 760px;
    }
    .rule { width: 56px; height: 2px; background: #e6b422; margin: 28px 0 18px; }
    .tagline {
      font-size: 19px; font-weight: 400;
      color: rgba(255,255,255,0.88);
      letter-spacing: 0.01em;
    }
  </style>
</head>
<body>
  <div class="overlay"></div>
  <div class="frame">
    <div class="eyebrow">Arriendo Maquinaria · Región del Maule</div>
    <div class="stack">
      <div class="headline">Maquinaria pesada<br>en arriendo.</div>
      <div class="rule"></div>
      <div class="tagline">JURMAQ · Curicó · +25 años en construcción</div>
    </div>
  </div>
</body>
</html>`;
}

function barracaHtml(heroDataUri) {
  return `<!doctype html>
<html lang="es-CL">
<head>
  <meta charset="utf-8">
  ${FONT_LINK}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 1200px; height: 630px; overflow: hidden; }
    body {
      display: grid;
      grid-template-columns: 600px 600px;
      font-family: 'Geist', -apple-system, sans-serif;
      color: #111111;
    }
    .left {
      background: #F7F6F3;
      padding: 64px;
      display: flex; flex-direction: column; justify-content: space-between;
      border-right: 1px solid #EAEAEA;
    }
    .eyebrow {
      font-size: 13px; font-weight: 600;
      letter-spacing: 0.18em; text-transform: uppercase;
      color: #9F2F2D;
    }
    .stack { display: flex; flex-direction: column; align-items: flex-start; }
    .headline {
      font-family: 'Newsreader', Georgia, serif;
      font-weight: 500;
      font-size: 66px;
      line-height: 1.02;
      letter-spacing: -0.025em;
      color: #111111;
    }
    .rule { width: 56px; height: 2px; background: #9F2F2D; margin: 28px 0 18px; }
    .tagline {
      font-size: 19px; font-weight: 400;
      color: #787774;
      letter-spacing: 0.01em;
    }
    .right {
      background: #FFFFFF;
      padding: 48px;
      display: flex; align-items: center; justify-content: center;
    }
    .right img {
      max-width: 100%; max-height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <div class="left">
    <div class="eyebrow">Barraca JURMAQ · +1.600 productos</div>
    <div class="stack">
      <div class="headline">Fierros<br>y materiales.</div>
      <div class="rule"></div>
      <div class="tagline">Curicó · Molina · Región del Maule</div>
    </div>
  </div>
  <div class="right">
    <img src="${heroDataUri}" alt="">
  </div>
</body>
</html>`;
}

/**
 * Render HTML → PNG vía Chrome headless CLI.
 *
 * Notas:
 * - Chrome necesita user-data-dir único por invocación, sino crashea si hay
 *   otra instancia de Chrome corriendo.
 * - --virtual-time-budget hace que Chrome avance el clock interno hasta que
 *   las fonts y otras assets async carguen (importante para Google Fonts).
 * - --hide-scrollbars evita franja de scroll.
 */
async function renderToPng(html, outputPath, tmpDir) {
  const htmlPath = join(tmpDir, `og-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  await writeFile(htmlPath, html, 'utf8');

  const userDataDir = join(tmpDir, `chrome-profile-${Math.random().toString(36).slice(2)}`);

  // headless=old exit limpio post-screenshot (headless=new a veces queda
  // colgado). --virtual-time-budget fuerza avance del clock para que
  // Google Fonts async-load complete antes del snapshot.
  const args = [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    `--user-data-dir=${userDataDir}`,
    '--window-size=1200,630',
    '--virtual-time-budget=10000',
    `--screenshot=${outputPath}`,
    `file://${htmlPath}`,
  ];

  await execFileAsync(CHROME_PATH, args, { timeout: 30_000 });

  const rawSize = (await stat(outputPath)).size;

  // Compresión lossy con color quantization. Saltado si pngquant no está.
  let optimized = false;
  try {
    await execFileAsync('pngquant', [
      '--quality=70-90',
      '--speed=1',
      '--strip',
      '--force',
      '--output', outputPath,
      outputPath,
    ], { timeout: 30_000 });
    optimized = true;
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('  (pngquant no instalado — skip optimización. brew install pngquant)');
    } else {
      console.log(`  (pngquant falló: ${err.message} — keep PNG sin optimizar)`);
    }
  }

  const size = (await stat(outputPath)).size;
  const warn = size > 300 * 1024 ? '  ⚠ exceeds 300KB' : '';
  const compression = optimized ? ` (${Math.round(rawSize / 1024)} → ${Math.round(size / 1024)} KB)` : ` (${Math.round(size / 1024)} KB)`;
  console.log(`  ✓ ${outputPath.replace(ROOT + '/', '')} ${compression}${warn}`);
}

async function main() {
  console.log('Inlining hero assets...');
  const [retroDataUri, barracaHeroDataUri] = await Promise.all([
    toDataUri(resolve(ROOT, 'apps/constructora/public/images/maquinarias/retroexcavadora-hmk-102b.jpg')),
    toDataUri(resolve(ROOT, 'apps/barraca/public/images/barraca-hero.jpg')),
  ]);

  const tmpDir = await mkdtemp(join(tmpdir(), 'og-gen-'));
  try {
    console.log('Rendering OG images via Chrome headless...');
    await renderToPng(
      constructoraHtml(retroDataUri),
      resolve(ROOT, 'apps/constructora/public/og-image-1200x630.png'),
      tmpDir,
    );
    await renderToPng(
      barracaHtml(barracaHeroDataUri),
      resolve(ROOT, 'apps/barraca/public/og-image-barraca-1200x630.png'),
      tmpDir,
    );
    console.log('Done.');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('OG generation failed:', err);
  process.exit(1);
});
