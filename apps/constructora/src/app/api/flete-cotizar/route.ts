import { NextRequest, NextResponse } from "next/server";
import { calcularFlete } from "@/lib/flete-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/flete-cotizar?direccion=Av+Argentina+1234,+Talca
 *
 * Devuelve el desglose completo del costo de traslado desde HQ Maquehua/Curicó
 * a la dirección indicada. Pipeline:
 *   1. ORS Geocoding (dirección → coordenadas + comuna detectada)
 *   2. ORS Directions HGV (HQ → coordenadas → distancia + tiempo real)
 *   3. Aplicar fórmula JURMAQ con peajes según comuna
 *
 * Response 200: FleteDesglose con todo el detalle.
 * Response 400: si falta el parámetro `direccion`.
 * Response 502: si la geocodificación o ruteo fallan (ORS sin key o sin match).
 */
export async function GET(req: NextRequest) {
  const direccion = req.nextUrl.searchParams.get("direccion");
  if (!direccion || direccion.trim().length < 5) {
    return NextResponse.json(
      { error: "Falta o es muy corta la dirección. Ej: 'Av Argentina 1234, Talca'" },
      { status: 400 },
    );
  }

  const desglose = await calcularFlete(direccion.trim());
  if (!desglose) {
    return NextResponse.json(
      { error: "No pudimos calcular el flete a esa dirección. Verifica que esté en Chile y sea específica." },
      { status: 502 },
    );
  }

  return NextResponse.json(desglose, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
