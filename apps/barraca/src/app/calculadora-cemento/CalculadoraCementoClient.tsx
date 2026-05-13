"use client";

import { useState, useMemo } from "react";

interface ElementoCemento {
  readonly slug: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly espesorCmDefault: number;
  readonly sacosPorM3: number;
  readonly notas: string;
}

const FACTOR_PERDIDA = 1.07;

export default function CalculadoraCementoClient({
  elementos,
}: {
  elementos: readonly ElementoCemento[];
}) {
  const [elementoSlug, setElementoSlug] = useState<string>(elementos[0].slug);
  const [areaInput, setAreaInput] = useState<string>("50");
  const [espesorInput, setEspesorInput] = useState<string>(String(elementos[0].espesorCmDefault));

  const elemento = useMemo(
    () => elementos.find((e) => e.slug === elementoSlug) ?? elementos[0],
    [elementoSlug, elementos]
  );

  function handleElementoChange(slug: string) {
    setElementoSlug(slug);
    const next = elementos.find((e) => e.slug === slug);
    if (next) setEspesorInput(String(next.espesorCmDefault));
  }

  const area = Math.max(0, Number(areaInput) || 0);
  const espesor = Math.max(0, Number(espesorInput) || 0);
  const volumenM3 = area * (espesor / 100);
  const sacosBase = volumenM3 * elemento.sacosPorM3;
  const sacosConPerdida = sacosBase * FACTOR_PERDIDA;

  return (
    <section className="py-12 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-navy-950 mb-6">Calcula tus sacos de cemento</h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="elemento" className="block text-sm font-medium text-gray-700 mb-2">
                Elemento
              </label>
              <select
                id="elemento"
                value={elementoSlug}
                onChange={(e) => handleElementoChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {elementos.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-600">{elemento.descripcion}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-2">
                  Área (m²)
                </label>
                <input
                  id="area"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={areaInput}
                  onChange={(e) => setAreaInput(e.target.value)}
                  placeholder="50"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="espesor" className="block text-sm font-medium text-gray-700 mb-2">
                  Espesor (cm)
                </label>
                <input
                  id="espesor"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={espesorInput}
                  onChange={(e) => setEspesorInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {volumenM3 > 0 && (
            <div
              role="region"
              aria-live="polite"
              aria-label="Resultado del cálculo"
              className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Volumen</div>
                <div className="text-2xl font-bold text-navy-950">
                  {volumenM3.toFixed(2)} m³
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Sacos base</div>
                <div className="text-2xl font-bold text-navy-950">
                  {Math.ceil(sacosBase).toLocaleString("es-CL")}
                </div>
              </div>
              <div className="bg-orange-600 rounded-lg p-4 text-center text-white">
                <div className="text-xs uppercase tracking-wider opacity-90 mb-1">A pedir (+7%)</div>
                <div className="text-2xl font-bold">
                  {Math.ceil(sacosConPerdida).toLocaleString("es-CL")} sacos
                </div>
              </div>
            </div>
          )}

          <p className="mt-5 text-xs text-gray-500">
            <strong>Importante:</strong> {elemento.notas} Sacos de cemento de 25 kg.
            Valores referenciales — la dosificación final depende del uso, exposición y
            calculista del proyecto (NCh 170:2016).
          </p>
        </div>
      </div>
    </section>
  );
}
