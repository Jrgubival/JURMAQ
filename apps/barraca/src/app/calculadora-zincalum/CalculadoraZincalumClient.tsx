"use client";

import { useState, useMemo } from "react";

interface TipoPlancha {
  readonly slug: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly anchoUtilM: number;
  readonly largoEstandarM: number;
  readonly notas: string;
}

export default function CalculadoraZincalumClient({
  tipos,
  tornillos366,
  tornillos6m,
  factorPerdida,
}: {
  tipos: readonly TipoPlancha[];
  tornillos366: number;
  tornillos6m: number;
  factorPerdida: number;
}) {
  const [tipoSlug, setTipoSlug] = useState<string>(tipos[0].slug);
  const [areaInput, setAreaInput] = useState<string>("80");
  const [largoInput, setLargoInput] = useState<string>(String(tipos[0].largoEstandarM));

  const tipo = useMemo(
    () => tipos.find((t) => t.slug === tipoSlug) ?? tipos[0],
    [tipoSlug, tipos]
  );

  function handleTipoChange(slug: string) {
    setTipoSlug(slug);
    const next = tipos.find((t) => t.slug === slug);
    if (next) setLargoInput(String(next.largoEstandarM));
  }

  const area = Math.max(0, Number(areaInput) || 0);
  const largoPlancha = Math.max(0.5, Number(largoInput) || tipo.largoEstandarM);
  const m2PorPlancha = tipo.anchoUtilM * largoPlancha;
  const planchasBase = m2PorPlancha > 0 ? area / m2PorPlancha : 0;
  const planchasFinales = Math.ceil(planchasBase * factorPerdida);

  // Tornillería: 9 para 3.66 m, 13 para 6 m, interpolado para otros largos
  const tornillosPorPlancha =
    largoPlancha >= 5.5 ? tornillos6m : largoPlancha >= 3 ? tornillos366 : 6;
  const tornillosTotal = planchasFinales * tornillosPorPlancha;

  return (
    <section className="py-12 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-navy-950 mb-6">Calcula tus planchas</h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="tipo" className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de plancha
              </label>
              <select
                id="tipo"
                value={tipoSlug}
                onChange={(e) => handleTipoChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {tipos.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.nombre} · ancho útil {t.anchoUtilM} m
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-600">{tipo.descripcion}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-2">
                  Área techumbre (m²)
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
                <p className="mt-1 text-[10px] text-gray-500">Real, ya con factor de pendiente</p>
              </div>
              <div>
                <label htmlFor="largo" className="block text-sm font-medium text-gray-700 mb-2">
                  Largo plancha (m)
                </label>
                <select
                  id="largo"
                  value={largoInput}
                  onChange={(e) => setLargoInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="2.0">2.0 m</option>
                  <option value="2.5">2.5 m</option>
                  <option value="3.0">3.0 m</option>
                  <option value="3.66">3.66 m (12 pies)</option>
                  <option value="6.0">6.0 m</option>
                </select>
              </div>
            </div>
          </div>

          {area > 0 && (
            <div role="region" aria-live="polite" aria-label="Resultado del cálculo">
              <div className="mt-6 mb-3 text-center">
                <span className="inline-block px-4 py-2 bg-navy-950 text-white text-sm font-semibold rounded-full tabular-nums">
                  m² cubiertos por plancha: {m2PorPlancha.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-orange-600 rounded-lg p-4 text-center text-white">
                  <div className="text-xs uppercase tracking-wider opacity-90 mb-1">Planchas a pedir</div>
                  <div className="text-3xl font-bold">{planchasFinales}</div>
                  <div className="text-[10px] opacity-80 mt-1">Incluye 7% pérdidas</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Tornillos 6.3 × 35</div>
                  <div className="text-3xl font-bold text-navy-950">{tornillosTotal}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{tornillosPorPlancha} por plancha · golilla EPDM</div>
                </div>
              </div>
            </div>
          )}

          <p className="mt-5 text-xs text-gray-500">
            <strong>Importante:</strong> {tipo.notas} El área debe ser real de techumbre
            (no proyección horizontal). Para techo a dos aguas con pendiente 22°, suma ~10% al área en planta.
          </p>
        </div>
      </div>
    </section>
  );
}
