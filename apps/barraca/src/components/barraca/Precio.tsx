import { formatCLP } from "@jurmaq/shared/format";
import type { VistaPrecio } from "@/lib/precio-web";

/**
 * Vigencia de los precios web (Ley 19.496: toda promoción informa su
 * duración). Se configura con NEXT_PUBLIC_PRECIO_WEB_VALIDO_HASTA (por ejemplo
 * "30 de noviembre de 2026"). No se inventa: si falta, en desarrollo se marca
 * en amarillo para que se vea que falta el dato, y en producción no se muestra.
 */
const VALIDO_HASTA = process.env.NEXT_PUBLIC_PRECIO_WEB_VALIDO_HASTA?.trim() || null;
const EN_DESARROLLO = process.env.NODE_ENV !== "production";

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
      {conOferta && (VALIDO_HASTA || EN_DESARROLLO) && (
        <p className={`mt-1 leading-tight text-gray-500 ${tamano === "ficha" ? "text-xs" : "text-[11px]"}`}>
          {tamano === "tarjeta" ? "Precio exclusivo online" : "Precio exclusivo de compra online"}, válido hasta{" "}
          {VALIDO_HASTA ?? <mark className="bg-amber-100 text-amber-900 rounded px-0.5">[COMPLETAR fecha]</mark>}
        </p>
      )}
    </div>
  );
}
