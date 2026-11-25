import { NextResponse } from "next/server";
import { leerContenido } from "@/lib/contenido/lectura";
import { armarPublico, publicoVacio } from "@/lib/contenido/publico";

/**
 * Popup, cinta superior y avisos (cierres, feriados, despacho) para el
 * navegador. Va aparte del HTML a propósito: publicar un aviso no regenera la
 * tienda, solo espera la caché corta (60 s). Público, solo lectura, sin datos
 * personales. Si D1 falla, el lector entrega el respaldo en código (popup de
 * código, sin cinta ni avisos) y esta ruta nunca responde con error.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const cabeceras = { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300" };
  try {
    const [popup, cinta, avisos] = await Promise.all([leerContenido("popup"), leerContenido("cinta"), leerContenido("avisos")]);
    return NextResponse.json(armarPublico({ popup, cinta, avisos }, Date.now()), { headers: cabeceras });
  } catch {
    return NextResponse.json(publicoVacio(), { headers: { "Cache-Control": "public, max-age=10" } });
  }
}
