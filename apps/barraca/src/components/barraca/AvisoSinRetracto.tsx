import { motivoSinRetracto } from "@/lib/retracto";

/**
 * "Este producto no tiene derecho a retracto" junto al precio, en la ficha y
 * en el carrito. Los Términos (11.5) piden que la advertencia sea destacada y
 * de un tamaño no menor que el del precio: por eso toma el mismo tamaño que
 * el bloque de precio donde va.
 */
export default function AvisoSinRetracto({
  codigo,
  tamano = "ficha",
}: {
  codigo: string | null | undefined;
  tamano?: "ficha" | "carrito";
}) {
  const motivo = motivoSinRetracto(codigo);
  if (!motivo) return null;
  return (
    <div role="note" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
      <p className={`font-bold leading-tight ${tamano === "ficha" ? "text-[2rem] sm:text-[2.5rem]" : "text-base"}`}>
        Este producto no tiene derecho a retracto
      </p>
      <p className="mt-1 text-sm">{motivo}.</p>
    </div>
  );
}
