"use client";

import { useState, useMemo } from "react";

interface TipoPintura {
  readonly slug: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly rendimientoM2PorL: number;
  readonly manosRecomendadas: number;
  readonly notas: string;
}

const FACTOR_PERDIDA = 1.1; // 10% pérdidas por brochazos y limpieza

export default function CalculadoraPinturaClient({
  tipos,
}: {
  tipos: readonly TipoPintura[];
}) {
  const [tipoSlug, setTipoSlug] = useState<string>(tipos[0].slug);
  const [areaInput, setAreaInput] = useState<string>("80");
  const [manosInput, setManosInput] = useState<string>(String(tipos[0].manosRecomendadas));

  const tipo = useMemo(
    () => tipos.find((t) => t.slug === tipoSlug) ?? tipos[0],
    [tipoSlug, tipos]
  );

  function handleTipoChange(slug: string) {
    setTipoSlug(slug);
    const next = tipos.find((t) => t.slug === slug);
    if (next) setManosInput(String(next.manosRecomendadas));
  }

  const area = Math.max(0, Number(areaInput) || 0);
  const manos = Math.max(1, Number(manosInput) || 1);
  const litrosBase = (area / tipo.rendimientoM2PorL) * manos;
  const litrosFinales = litrosBase * FACTOR_PERDIDA;
  const galones = litrosFinales / 3.78;

  return (
    <section className="py-12 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-navy-950 mb-6">Calcula tu pintura</h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de pintura
              </label>
              <select
                id="tipo"
                value={tipoSlug}
                onChange={(e) => handleTipoChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {tipos.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.nombre} ({t.rendimientoM2PorL} m²/L)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-600">{tipo.descripcion}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-2">
                  Área a pintar (m²)
                </label>
                <input
                  id="area"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="1"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="manos" className="block text-sm font-medium text-gray-700 mb-2">
                  Manos a aplicar
                </label>
                <input
                  id="manos"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="5"
                  step="1"
                  value={manosInput}
                  onChange={(e) => setManosInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {area > 0 && (
            <div
              role="region"
              aria-live="polite"
              aria-label="Resultado del cálculo"
              className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Litros base</div>
                <div className="text-2xl font-bold text-navy-950">{litrosBase.toFixed(1)} L</div>
              </div>
              <div className="bg-orange-600 rounded-lg p-4 text-center text-white">
                <div className="text-xs uppercase tracking-wider opacity-90 mb-1">Litros a comprar</div>
                <div className="text-2xl font-bold">{Math.ceil(litrosFinales)} L</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Equivalente</div>
                <div className="text-2xl font-bold text-navy-950">{galones.toFixed(1)} gal</div>
              </div>
            </div>
          )}

          <p className="mt-5 text-xs text-gray-500">
            <strong>Nota:</strong> {tipo.notas} Incluye 10% por pérdidas (brochazos,
            retoques, limpieza). Resta puertas y ventanas grandes del área. 1 galón ≈ 3.78 L.
          </p>
        </div>
      </div>
    </section>
  );
}
