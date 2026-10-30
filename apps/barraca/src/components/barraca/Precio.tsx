import { formatCLP } from "@jurmaq/shared/format";
import type { VistaPrecio } from "@/lib/precio-web";
import { precioWebHasta } from "@/lib/vigencia";

/**
 * Bloque de precio de la tienda, igual en tarjeta, ficha y barra del celular:
 *   Precio web  $7.910 /un  −29%
 *   Precio normal $11.210   (tachado)
 * Con un solo precio, sólo el monto. Si no se puede comprar, "No disponible".
 */
export default function Precio({
  vista,
  unidad,
  tamano = "tarjeta",
}: {
  vista: VistaPrecio;
  unidad?: string | null;
  tamano?: "tarjeta" | "ficha" | "barra";
}) {
  if (!vista.disponible) {
    return (
      <p className={`font-semibold text-gray-500 ${tamano === "ficha" ? "text-xl" : "text-base"}`}>
        No disponible
      </p>
    );
  }

  const monto = {
    tarjeta: "text-xl sm:text-2xl",
    barra: "text-2xl",
    ficha: "text-[2rem] sm:text-[2.5rem]",
  }[tamano];
  const conOferta = vista.precioNormal != null;
  const unitLabel = unidad ? `/${unidad.toLowerCase()}` : "";

  return (
    <div className="tabular-nums">
      {conOferta && (
        <p className={`font-semibold text-marca-700 leading-none mb-1 ${tamano === "ficha" ? "text-sm" : "text-[11px] uppercase tracking-wide"}`}>
          Precio web
        </p>
      )}
      <p className="leading-none flex items-baseline flex-wrap gap-x-1.5 gap-y-1">
        <span className={`${monto} font-extrabold tracking-tight ${conOferta ? "text-marca-700" : "text-navy-950"}`}>
          {formatCLP(vista.precioWeb)}
        </span>
        {unitLabel && <span className="text-xs text-gray-500">{unitLabel}</span>}
        {conOferta && tamano !== "tarjeta" && (
          <span className="self-center ml-1 px-1.5 py-0.5 rounded-md text-xs font-bold bg-marca-600 text-white">
            −{vista.ahorroPct}%
          </span>
        )}
      </p>
      {conOferta && (
        <p className={`mt-1.5 text-gray-500 leading-none ${tamano === "ficha" ? "text-sm" : "text-xs"}`}>
          Precio normal <span className="line-through">{formatCLP(vista.precioNormal!)}</span>
        </p>
      )}
      {/* Duración del precio web (art. 35): sólo en la ficha, no en las tarjetas. */}
      {tamano === "ficha" && (
        <p className="mt-2 text-xs text-gray-500 leading-snug">
          {precioWebHasta() ? `Precio web válido hasta el ${precioWebHasta()}; puede cambiar.` : "Precio web vigente hoy."} Tu compra queda con el precio que confirmas. <a href="/terminos#5-precios" className="underline underline-offset-2 hover:text-navy-950">Condiciones</a>
        </p>
      )}
    </div>
  );
}
