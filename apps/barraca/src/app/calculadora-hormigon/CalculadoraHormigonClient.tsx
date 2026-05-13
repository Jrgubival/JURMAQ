"use client";

import { useState, useMemo } from "react";

interface GradoHormigon {
  readonly slug: string;
  readonly nombre: string;
  readonly descripcion: string;
  readonly sacosPorM3: number;
  readonly arenaM3PorM3: number;
  readonly gravillaM3PorM3: number;
  readonly aguaLPorM3: number;
  readonly notas: string;
}

const FACTOR_PERDIDA = 1.07;

export default function CalculadoraHormigonClient({
  grados,
}: {
  grados: readonly GradoHormigon[];
}) {
  const defaultGrado = grados.find((g) => g.slug === "h20") ?? grados[0];
  const [gradoSlug, setGradoSlug] = useState<string>(defaultGrado.slug);
  const [largoInput, setLargoInput] = useState<string>("5");
  const [anchoInput, setAnchoInput] = useState<string>("5");
  const [espesorInput, setEspesorInput] = useState<string>("10");

  const grado = useMemo(
    () => grados.find((g) => g.slug === gradoSlug) ?? grados[0],
    [gradoSlug, grados]
  );

  const largo = Math.max(0, Number(largoInput) || 0);
  const ancho = Math.max(0, Number(anchoInput) || 0);
  const espesor = Math.max(0, Number(espesorInput) || 0);
  const volumen = largo * ancho * (espesor / 100);

  const sacos = volumen * grado.sacosPorM3 * FACTOR_PERDIDA;
  const arena = volumen * grado.arenaM3PorM3 * FACTOR_PERDIDA;
  const gravilla = volumen * grado.gravillaM3PorM3 * FACTOR_PERDIDA;
  const agua = volumen * grado.aguaLPorM3;

  return (
    <section className="py-12 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-navy-950 mb-6">Calcula tu hormigón</h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="grado" className="block text-sm font-medium text-gray-700 mb-2">
                Grado de hormigón
              </label>
              <select
                id="grado"
                value={gradoSlug}
                onChange={(e) => setGradoSlug(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                {grados.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.nombre}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-600">{grado.descripcion}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="largo" className="block text-sm font-medium text-gray-700 mb-2">
                  Largo (m)
                </label>
                <input
                  id="largo"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={largoInput}
                  onChange={(e) => setLargoInput(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="ancho" className="block text-sm font-medium text-gray-700 mb-2">
                  Ancho (m)
                </label>
                <input
                  id="ancho"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={anchoInput}
                  onChange={(e) => setAnchoInput(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {volumen > 0 && (
            <div role="region" aria-live="polite" aria-label="Resultado del cálculo">
              <div className="mt-6 mb-3 text-center">
                <span className="inline-block px-4 py-2 bg-navy-950 text-white text-sm font-semibold rounded-full">
                  Volumen: {volumen.toFixed(2)} m³
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-orange-600 rounded-lg p-4 text-center text-white">
                  <div className="text-xs uppercase tracking-wider opacity-90 mb-1">Cemento</div>
                  <div className="text-xl font-bold">{Math.ceil(sacos)} sacos</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Arena</div>
                  <div className="text-xl font-bold text-navy-950">{arena.toFixed(2)} m³</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Gravilla</div>
                  <div className="text-xl font-bold text-navy-950">{gravilla.toFixed(2)} m³</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Agua</div>
                  <div className="text-xl font-bold text-navy-950">{Math.round(agua)} L</div>
                </div>
              </div>
            </div>
          )}

          <p className="mt-5 text-xs text-gray-500">
            <strong>Importante:</strong> {grado.notas} Sacos cemento 25 kg. Incluye 7% por
            pérdidas. Valores referenciales NCh 170:2016.
          </p>
        </div>
      </div>
    </section>
  );
}
