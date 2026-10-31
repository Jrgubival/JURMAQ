import { formatCLP } from "@jurmaq/shared/format";
import { comboValido, textoCombo, totalLinea, type Combo } from "@/lib/combos";

/**
 * Nota chica bajo un producto del carrito: "Lleva 2 por $12.000", y cuando ya
 * se aplica, cuánto ahorras. Discreta a propósito (sin badges ni colores fuertes).
 */
export default function LineaCombo({
  precio,
  cantidad,
  combo,
  className = "",
}: {
  precio: number;
  cantidad: number;
  combo?: Combo | null;
  className?: string;
}) {
  const c = comboValido(combo, precio);
  if (!c) return null;
  const { ahorro } = totalLinea(precio, cantidad, c);
  return (
    <p className={`text-xs tabular-nums ${ahorro > 0 ? "text-[#2F7F4E]" : "text-gray-500"} ${className}`}>
      {textoCombo(c)}
      {ahorro > 0 && <> · ahorras {formatCLP(ahorro)}</>}
    </p>
  );
}
