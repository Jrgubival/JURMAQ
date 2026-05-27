/**
 * flete-pricing — Cálculo de costo de traslado de maquinaria.
 *
 * Fórmula JURMAQ (calculadora interna, 2026):
 *
 *   distancia_total = km_ida × 2
 *   tiempo_op_min  = (min_ida × 2) + 30 carga/descarga
 *   tiempo_op_hr   = tiempo_op_min / 60
 *   costo_km       = distancia_total × $1.000/km
 *   costo_hr       = tiempo_op_hr × $11.000/hr
 *   subtotal       = costo_km + costo_hr + peajes_round_trip
 *   total_calc     = subtotal × 1.50   (mantención 25% + utilidad 25%)
 *   total          = max(total_calc, $60.000)   (piso operativo)
 *
 * Input: dirección de la obra como string libre ("Av Argentina 1234, Talca").
 * Pipeline:
 *   1. Geocode dirección → lat/lng + comuna detectada (ORS Geocoding)
 *   2. Route HQ → obra → distancia + tiempo (ORS Directions HGV)
 *   3. Peajes = lookup en tabla por comuna normalizada
 *   4. Aplicar fórmula
 *
 * HQ origen: Constructora JURMAQ, LT 3 Del LT A HJ 11, Maquehua, Curicó.
 * Coords importadas de @jurmaq/shared/seo para mantener una sola fuente
 * de verdad entre runtime (este archivo) y build-time (script de SEO).
 */

import { HQ_CONSTRUCTORA } from "@jurmaq/shared/seo";
import { env } from "@jurmaq/shared/env";

// ---------------------------------------------------------------------------
// Constantes de la fórmula
// ---------------------------------------------------------------------------

export const COSTO_KM = 1000;         // $/km (cubre combustible, neumáticos, amortización)
export const COSTO_HR = 11000;        // $/hr trabajador (chofer A4/A5 con cargas sociales)
export const TIEMPO_CARGA_MIN = 30;   // minutos carga + descarga combinados
export const PCT_MANTENCION = 0.25;   // 25% sobre subtotal
export const PCT_UTILIDAD = 0.25;     // 25% sobre subtotal

/**
 * Piso operativo: independiente de la distancia, sacar el camión + chofer +
 * coordinación administrativa tiene un costo fijo. Trayectos cortos (Curicó,
 * Romeral) caerían bajo este número si solo aplicamos la fórmula lineal.
 *
 * Si querés afinar: medilo como (jornada chofer media / cuántos fletes
 * típicos por día) + overhead administrativo + costo de tener el camión
 * inmovilizado entre fletes.
 */
export const FLETE_MINIMO = 60000;    // $ piso para cualquier flete

export const HQ_LAT = HQ_CONSTRUCTORA.lat;
export const HQ_LNG = HQ_CONSTRUCTORA.lng;

// ---------------------------------------------------------------------------
// Peajes round-trip por comuna detectada (normalizada lowercase, sin tildes)
// ---------------------------------------------------------------------------
// Plazas Ruta 5 Sur en la región (2026):
//   - Plaza Quinta (km 161, entre Teno y Curicó) — al NORTE de HQ
//   - Plaza Río Claro (km 217, entre Molina y Pelarco) — al SUR de HQ
//   - Plaza Río Maule (km 274, entre Talca y Linares) — al SUR
//
// Tarifa camión × plaza × round-trip ≈ $16.000 (estimado). Calibrar con datos.

const PEAJE_PLAZA_RT = 16000;

export const PEAJES_POR_COMUNA: Record<string, number> = {
  // HQ y entorno inmediato
  "curico": 0,

  // Norte: cruza Plaza Quinta (km 161)
  "teno": PEAJE_PLAZA_RT,

  // Sur: cruza Plaza Río Claro (km 217)
  "molina": PEAJE_PLAZA_RT,
  "talca": PEAJE_PLAZA_RT,
  "pelarco": PEAJE_PLAZA_RT,
  "rio claro": PEAJE_PLAZA_RT,
  "san rafael": PEAJE_PLAZA_RT,
  "maule": PEAJE_PLAZA_RT,

  // Más al sur: cruza Río Claro + Río Maule
  "san javier": PEAJE_PLAZA_RT * 2,
  "linares": PEAJE_PLAZA_RT * 2,
  "yerbas buenas": PEAJE_PLAZA_RT * 2,
  "colbun": PEAJE_PLAZA_RT * 2,
  "longavi": PEAJE_PLAZA_RT * 2,
  "parral": PEAJE_PLAZA_RT * 2,
  "retiro": PEAJE_PLAZA_RT * 2,
  "villa alegre": PEAJE_PLAZA_RT * 2,

  // Costa via Talca: cruza Río Claro
  "constitucion": PEAJE_PLAZA_RT,
  "empedrado": PEAJE_PLAZA_RT,
  "pencahue": PEAJE_PLAZA_RT,
  "san clemente": PEAJE_PLAZA_RT,

  // Cauquenes y aledaños (Pan-American + transversal)
  "cauquenes": PEAJE_PLAZA_RT * 2,
  "chanco": PEAJE_PLAZA_RT * 2,
  "pelluhue": PEAJE_PLAZA_RT * 2,

  // Locales/transversales sin plazas mayores
  "romeral": 0,
  "rauco": 0,
  "sagrada familia": 0,
  "hualane": 0,
  "licanten": 0,
  "vichuquen": 0,
};

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface FleteDesglose {
  direccionConsultada: string;
  direccionGeocodificada: string;
  comuna: string | null;
  region: string | null;
  distanciaIdaKm: number;
  tiempoIdaMin: number;
  distanciaTotalKm: number;
  tiempoOpMin: number;
  tiempoOpHr: number;
  costoKm: number;
  costoHr: number;
  peajes: number;
  subtotal: number;
  mantencion: number;
  utilidad: number;
  /** Total computado por la fórmula (antes de aplicar piso). */
  totalCalculado: number;
  /** Total final cobrado al cliente: max(totalCalculado, FLETE_MINIMO). */
  total: number;
  /** True si el piso FLETE_MINIMO se aplicó (UI puede mostrar badge "mínimo"). */
  minimoAplicado: boolean;
}

// ---------------------------------------------------------------------------
// Geocoding — Nominatim (OpenStreetMap)
// ---------------------------------------------------------------------------
// Gratis, sin API key. Política: 1 req/sec y User-Agent identificable.
// ORS Geocoding requiere plan paid, no nos sirve para el tier gratis.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

interface NominatimResult {
  lat?: string;
  lon?: string;
  display_name?: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
  };
}

function normalizeComuna(s: string | undefined | null): string | null {
  if (!s) return null;
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .trim();
}

async function geocodeAddress(text: string): Promise<{
  lat: number;
  lng: number;
  label: string;
  comuna: string | null;
  region: string | null;
} | null> {
  const params = new URLSearchParams({
    q: text,
    format: "json",
    countrycodes: "cl",
    limit: "1",
    addressdetails: "1",
  });

  try {
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: {
        "User-Agent": "JURMAQ-flete/1.0 (contacto@jurmaq.cl)",
      },
    });
    if (!res.ok) return null;
    const data: NominatimResult[] = await res.json();
    const f = data?.[0];
    if (!f?.lat || !f?.lon) return null;
    const lat = parseFloat(f.lat);
    const lng = parseFloat(f.lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    const comunaRaw =
      f.address?.city ||
      f.address?.town ||
      f.address?.village ||
      f.address?.municipality ||
      f.address?.county ||
      f.name ||
      null;
    return {
      lat,
      lng,
      label: f.display_name || text,
      comuna: normalizeComuna(comunaRaw),
      region: f.address?.state || null,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ORS Directions
// ---------------------------------------------------------------------------

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-hgv";

interface ORSDirectionsResponse {
  routes?: Array<{ summary?: { distance?: number; duration?: number } }>;
}

async function getORSRoute(
  destLat: number,
  destLng: number,
): Promise<{ distanciaKm: number; tiempoMin: number } | null> {
  const apiKey = env.ORS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(ORS_DIRECTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        coordinates: [
          [HQ_LNG, HQ_LAT],
          [destLng, destLat],
        ],
      }),
    });

    if (!res.ok) return null;
    const data: ORSDirectionsResponse = await res.json();
    const summary = data.routes?.[0]?.summary;
    if (!summary?.distance || !summary?.duration) return null;

    return {
      distanciaKm: summary.distance / 1000,
      tiempoMin: summary.duration / 60,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cálculo principal
// ---------------------------------------------------------------------------

/**
 * Calcula el costo de traslado a una dirección libre. Geocodifica, rutea
 * y aplica fórmula JURMAQ con peajes según comuna detectada.
 */
export async function calcularFlete(direccion: string): Promise<FleteDesglose | null> {
  const geo = await geocodeAddress(direccion);
  if (!geo) return null;

  const ruta = await getORSRoute(geo.lat, geo.lng);
  if (!ruta) return null;

  const distanciaTotalKm = ruta.distanciaKm * 2;
  const tiempoOpMin = ruta.tiempoMin * 2 + TIEMPO_CARGA_MIN;
  const tiempoOpHr = tiempoOpMin / 60;

  const costoKm = Math.round(distanciaTotalKm * COSTO_KM);
  const costoHr = Math.round(tiempoOpHr * COSTO_HR);
  const peajes: number = geo.comuna ? (PEAJES_POR_COMUNA[geo.comuna] ?? 0) : 0;

  const subtotal = costoKm + costoHr + peajes;
  const mantencion = Math.round(subtotal * PCT_MANTENCION);
  const utilidad = Math.round(subtotal * PCT_UTILIDAD);
  const totalCalculado = subtotal + mantencion + utilidad;
  const total = Math.max(totalCalculado, FLETE_MINIMO);
  const minimoAplicado = totalCalculado < FLETE_MINIMO;

  return {
    direccionConsultada: direccion,
    direccionGeocodificada: geo.label,
    comuna: geo.comuna,
    region: geo.region,
    distanciaIdaKm: Math.round(ruta.distanciaKm * 10) / 10,
    tiempoIdaMin: Math.round(ruta.tiempoMin),
    distanciaTotalKm: Math.round(distanciaTotalKm * 10) / 10,
    tiempoOpMin: Math.round(tiempoOpMin),
    tiempoOpHr: Math.round(tiempoOpHr * 100) / 100,
    costoKm,
    costoHr,
    peajes,
    subtotal,
    mantencion,
    utilidad,
    totalCalculado,
    total,
    minimoAplicado,
  };
}
