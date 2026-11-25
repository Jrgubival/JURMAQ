import { metadataRecursoProtegido } from "@/lib/mcp/config";

/** RFC 9728 §3.1: metadata del recurso /api/mcp (con la ruta añadida, la que Claude prueba primero). */
export const dynamic = "force-static";

export function GET() {
  return Response.json(metadataRecursoProtegido(), {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
