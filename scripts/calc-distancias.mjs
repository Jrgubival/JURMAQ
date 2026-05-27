#!/usr/bin/env node
/**
 * Genera packages/shared/src/seo/distancias.generated.ts con distancia y
 * tiempo de despacho desde las dos HQs físicas (Molina barraca, Maquehua
 * constructora) a cada ciudad de CIUDADES.
 *
 * Por qué generar y no calcular en runtime: las landings SEO son SSG, el
 * texto "Despacho desde Curicó a Talca · 69 km" tiene que estar en el HTML
 * estático para que Google lo crawlee. Pero queremos UNA sola fuente de
 * verdad de coordenadas + ruteo (OSRM) compartida con el calculador de
 * flete dinámico (flete-pricing.ts).
 *
 * Cuándo re-ejecutar:
 *   - Cuando agregas o sacas una ciudad de CIUDADES
 *   - Cuando cambias HQ_BARRACA o HQ_CONSTRUCTORA
 *   - Cuando OSRM actualiza su grafo y querés refrescar
 *
 * Uso:
 *   node scripts/calc-distancias.mjs
 *
 * El archivo generado se commitea al repo (no es prebuild) para evitar
 * dependencia de red en CI/deploy. Si CI debe verificarlo, correr el
 * script con --check y diffear contra el archivo committeado.
 *
 * NOTA: Las coords están duplicadas aquí porque .mjs no puede importar
 * .ts directamente sin tooling. Si modificás un HQ en seo/index.ts,
 * actualizá también acá (busca HQ_BARRACA / HQ_CONSTRUCTORA).
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(
  __dirname,
  "../packages/shared/src/seo/distancias.generated.ts",
);

// Debe coincidir con HQ_BARRACA en packages/shared/src/seo/index.ts
const HQ_BARRACA = { lat: -35.1147, lng: -71.2839 };

// Debe coincidir con HQ_CONSTRUCTORA en packages/shared/src/seo/index.ts
const HQ_CONSTRUCTORA = { lat: -34.9785, lng: -71.1985 };

// Debe coincidir con los slug/lat/lng de CIUDADES en packages/shared/src/seo/index.ts
const CIUDADES = [
  { slug: "curico", lat: -34.9853, lng: -71.2367 },
  { slug: "molina", lat: -35.1147, lng: -71.2839 },
  { slug: "teno", lat: -34.8744, lng: -71.1644 },
  { slug: "romeral", lat: -34.9667, lng: -71.1417 },
  { slug: "sagrada-familia", lat: -35.0019, lng: -71.3853 },
  { slug: "hualane", lat: -34.9744, lng: -71.8 },
  { slug: "licanten", lat: -34.9819, lng: -72.0072 },
  { slug: "vichuquen", lat: -34.8814, lng: -72.05 },
  { slug: "rauco", lat: -34.9322, lng: -71.3092 },
  { slug: "talca", lat: -35.4264, lng: -71.6553 },
  { slug: "linares", lat: -35.8475, lng: -71.5933 },
  { slug: "constitucion", lat: -35.3331, lng: -72.415 },
];

// Buffer 15% sobre tiempo OSRM (que asume auto liviano) para reflejar
// camión cargado con maquinaria.
const TRUCK_BUFFER = 1.15;

function formatTiempo(min) {
  const m = Math.round(min);
  if (m < 5) return "inmediato";
  if (m < 60) {
    const r = Math.round(m / 5) * 5;
    return `${r} minutos`;
  }
  if (m === 60) return "1 hora";
  if (m === 120) return "2 horas";
  const h = Math.floor(m / 60);
  const mm = Math.round((m - h * 60) / 5) * 5;
  if (mm === 0) return `${h} ${h === 1 ? "hora" : "horas"}`;
  if (mm === 60) return `${h + 1} ${h + 1 === 1 ? "hora" : "horas"}`;
  return `${h}h ${mm}min`;
}

async function osrmRoute(originLng, originLat, destLng, destLat) {
  const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const data = await res.json();
  const r = data.routes?.[0];
  if (!r) throw new Error("no route");
  return { km: r.distance / 1000, min: r.duration / 60 };
}

async function distanciasParaOrigen(origen, label) {
  console.error(`Calculando desde ${label}...`);
  const result = {};
  for (const c of CIUDADES) {
    try {
      const r = await osrmRoute(origen.lng, origen.lat, c.lng, c.lat);
      const km = Math.round(r.km);
      const minAjustado = r.min * TRUCK_BUFFER;
      const tiempo = formatTiempo(minAjustado);
      result[c.slug] = {
        km,
        min: Math.round(minAjustado),
        tiempo,
      };
      console.error(`  ${c.slug.padEnd(20)} ${String(km).padStart(3)} km · ${tiempo}`);
      await new Promise((r) => setTimeout(r, 300));
    } catch (e) {
      console.error(`  ${c.slug} ERROR: ${e.message}`);
      throw e;
    }
  }
  return result;
}

function serialize(name, data) {
  const entries = Object.entries(data)
    .map(([slug, v]) => `  "${slug}": { km: ${v.km}, min: ${v.min}, tiempo: "${v.tiempo}" },`)
    .join("\n");
  return `export const ${name}: Record<string, { km: number; min: number; tiempo: string }> = {\n${entries}\n};`;
}

async function main() {
  const barraca = await distanciasParaOrigen(HQ_BARRACA, "HQ_BARRACA (Av. Poniente, Molina)");
  const constructora = await distanciasParaOrigen(HQ_CONSTRUCTORA, "HQ_CONSTRUCTORA (Maquehua)");

  const content = `/**
 * AUTO-GENERADO por scripts/calc-distancias.mjs — NO EDITAR A MANO.
 *
 * Distancia (km) y tiempo de despacho desde cada HQ física a cada ciudad
 * de CIUDADES. Calculado con OSRM público + buffer 15% para camión cargado.
 *
 * Para regenerar: \`node scripts/calc-distancias.mjs\`
 *
 * Última generación: ${new Date().toISOString()}
 */

${serialize("DISTANCIAS_BARRACA", barraca)}

${serialize("DISTANCIAS_CONSTRUCTORA", constructora)}
`;

  writeFileSync(OUTPUT_PATH, content, "utf8");
  console.error(`\n✓ Escrito ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
