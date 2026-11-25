import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { env } from "@jurmaq/shared/env";
import { safeSecretEquals } from "@jurmaq/shared/crypto/secret";
import { rateLimit, getClientIp } from "@jurmaq/shared/rate-limit";
import { invalidarLecturaContenido } from "@/lib/contenido/lectura";

/**
 * Regenera las páginas que muestran contenido editable (D1). Pensado para
 * correrlo DESPUÉS de cada deploy: el build no puede leer D1, así que esas
 * páginas salen horneadas con el respaldo en código hasta que se regeneran
 * (cada 5 minutos a 1 hora por su `revalidate`, o ahora con esta ruta).
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *        "https://barraca.jurmaq.cl/api/contenido/revalidar?ambito=toda"
 *
 * ambito=paginas (por defecto): términos, privacidad, envíos, nosotros,
 *   contacto, sucursales y portada.
 * ambito=toda: además toda la tienda (pie, datos del local en fichas y
 *   categorías); se regenera de a poco, a medida que alguien las pide.
 *
 * Protegido con CRON_SECRET (timing-safe, fail-closed), como /api/revalidar.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (!rateLimit(`revalidar-contenido:${ip}`, { maxAttempts: 10, windowSeconds: 60 }).success) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }
  const secreto = env.CRON_SECRET?.trim();
  const recibido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!secreto || !safeSecretEquals(recibido, secreto)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  invalidarLecturaContenido();
  const rutas = ["/terminos", "/privacidad", "/envios-y-devoluciones", "/nosotros", "/contacto", "/sucursales", "/"];
  for (const r of rutas) revalidatePath(r);
  const toda = request.nextUrl.searchParams.get("ambito") === "toda";
  if (toda) revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, revalidado: rutas, toda });
}
