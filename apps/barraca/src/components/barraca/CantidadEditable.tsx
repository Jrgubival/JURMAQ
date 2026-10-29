"use client";

import { useEffect, useState } from "react";

/**
 * Selector de cantidad − [n] +, con el número escribible. En una barraca se
 * llevan 40 barras o 30 sacos: tocar "+" 40 veces no es opción.
 *
 * Mientras se escribe, el campo puede quedar vacío; el rango 1..max se aplica
 * al salir del campo o con Enter, y si se pidió más que el stock lo avisa.
 */
export default function CantidadEditable({
  valor,
  max,
  onCambio,
  nombre,
  chico = false,
}: {
  valor: number;
  max: number;
  onCambio: (n: number) => void;
  /** Para los aria-label ("Aumentar cantidad de …"). */
  nombre?: string;
  chico?: boolean;
}) {
  const [texto, setTexto] = useState(String(valor));
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => setTexto(String(valor)), [valor]);

  const tope = Math.max(1, max);
  function confirmar(bruto: string) {
    const n = Number.parseInt(bruto, 10);
    if (!Number.isFinite(n) || n < 1) {
      setTexto(String(valor));
      return;
    }
    const final = Math.min(n, tope);
    setAviso(n > tope ? `Solo hay ${tope} disponibles` : null);
    setTexto(String(final));
    if (final !== valor) onCambio(final);
  }
  function paso(d: number) {
    const final = Math.min(Math.max(1, valor + d), tope);
    setAviso(null);
    if (final !== valor) onCambio(final);
  }

  const alto = chico ? "h-10" : "h-11";
  const de = nombre ? ` de ${nombre}` : "";
  return (
    <div>
      <div className="inline-flex items-center border border-gray-300 rounded-xl overflow-hidden bg-white">
        <button
          type="button"
          onClick={() => paso(-1)}
          disabled={valor <= 1}
          aria-label={`Disminuir cantidad${de}`}
          className={`w-11 ${alto} flex items-center justify-center text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-35 transition-colors`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={tope}
          value={texto}
          aria-label={`Cantidad${de}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setTexto(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={(e) => confirmar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={`w-14 ${alto} text-center text-base font-bold text-navy-950 tabular-nums border-x border-gray-300 focus:outline-none focus:bg-marca-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        <button
          type="button"
          onClick={() => paso(1)}
          disabled={valor >= tope}
          aria-label={`Aumentar cantidad${de}`}
          className={`w-11 ${alto} flex items-center justify-center text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-35 transition-colors`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
      </div>
      {aviso && <p className="mt-1 text-xs font-medium text-amber-700" role="status">{aviso}</p>}
    </div>
  );
}
