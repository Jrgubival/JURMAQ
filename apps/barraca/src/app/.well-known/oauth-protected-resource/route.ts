import { metadataRecursoProtegido } from "@/lib/mcp/config";

/** RFC 9728: metadata del recurso protegido (versión en la raíz). */
export const dynamic = "force-static";

export function GET() {
  return Response.json(metadataRecursoProtegido(), {
    headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
  });
}
