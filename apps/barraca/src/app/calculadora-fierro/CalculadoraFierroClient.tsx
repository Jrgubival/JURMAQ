"use client";

import { useState, useMemo } from "react";

interface ElementoFierro {
  readonly slug: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly cuantiaKgPorM2: number;
  readonly notas: string;
}

const KG_POR_QUINTAL = 46;
const FACTOR_PERDIDA = 1.07; // 7% por traslapes y despuntes

export default function CalculadoraFierroClient({
  elementos,
}: {
  elementos: readonly ElementoFierro[];
}) {
  const [elementoSlug, setElementoSlug] = useState<string>(elementos[0].slug);
  const [areaInput, setAreaInput] = useState<string>("100");

  const elemento = useMemo(
    () => elementos.find((e) => e.slug === elementoSlug) ?? elementos[0],
    [elementoSlug, elementos]
  );

  const area = Math.max(0, Number(areaInput) || 0);
  const kgBase = area * elemento.cuantiaKgPorM2;
  const kgConPerdida = kgBase * FACTOR_PERDIDA;
  const quintalesConPerdida = kgConPerdida / KG_POR_QUINTAL;

  return (
    <section className="py-12 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-navy-950 mb-6">Calcula tu pedido</h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="elemento" className="block text-sm font-medium text-gray-700 mb-2">
                Elemento estructural
              </label>
              <select
                id="elemento"
                value={elementoSlug}
                onChange={(e) => setElementoSlug(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {elementos.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.nombre} ({e.cuantiaKgPorM2} kg/m²)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-600">{elemento.descripcion}</p>
            </div>

            <div>
              <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-2">
                {elemento.slug === "fundacion-corrida" || elemento.slug === "viga"
                  ? "Metros lineales"
                  : "Área en m²"}
              </label>
              <input
                id="area"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={areaInput}
                onChange={(e) => setAreaInput(e.target.value)}
                placeholder="100"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
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
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  Cuantía base
                </div>
                <div className="text-2xl font-bold text-navy-950">
                  {Math.round(kgBase).toLocaleString("es-CL")} kg
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  Con 7% pérdida
                </div>
                <div className="text-2xl font-bold text-navy-950">
                  {Math.round(kgConPerdida).toLocaleString("es-CL")} kg
                </div>
              </div>
              <div className="bg-orange-600 rounded-lg p-4 text-center text-white">
                <div className="text-xs uppercase tracking-wider opacity-90 mb-1">
                  Quintales a pedir
                </div>
                <div className="text-2xl font-bold">
                  {quintalesConPerdida.toFixed(1)} qq
                </div>
              </div>
            </div>
          )}

          <p className="mt-5 text-xs text-gray-500">
            <strong>Importante:</strong> {elemento.notas} El cálculo definitivo lo hace el
            calculista estructural según NCh 430:2008 y NCh 433:2009. Estos valores son
            referenciales para vivienda 1-2 pisos.
          </p>
        </div>
      </div>
    </section>
  );
}
