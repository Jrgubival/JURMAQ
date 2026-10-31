import { NextResponse } from 'next/server';
import { zonasDespachoVigentes } from '@/lib/despacho/tarifas-db';

/**
 * GET /api/tienda/zonas — zonas del camión con sus tarifas vigentes, para que
 * el selector de zona y el checkout muestren los montos editados en el panel.
 * Sólo informa: el monto que se cobra lo recalcula el servidor al crear el pedido.
 */
export async function GET() {
  const { zonas } = await zonasDespachoVigentes();
  return NextResponse.json(
    { zonas },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
