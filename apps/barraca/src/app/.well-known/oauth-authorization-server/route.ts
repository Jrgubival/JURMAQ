import { metadataServidorAutorizacion } from "@/lib/mcp/config";

/** RFC 8414: metadata del servidor de autorización (el issuer es el origen, sin ruta). */
export const dynamic = "force-static";

export function GET() {
  return Response.json(metadataServidorAutorizacion(), {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
