'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatCLP } from '@jurmaq/shared/format';
import { whatsappCtaMaquinaria } from '@jurmaq/shared/whatsapp';

/**
 * PricingTiers — Tabla de tarifas según unidad de la máquina.
 *
 * Reglas de pricing (actualizadas 2026-05-23):
 *
 *   Si tarifa POR DÍA (unidad_tarifa = 'dia'):
 *     - 1 día   = tarifa_neta
 *     - 1 sem   = tarifa_neta × 4   (no × 5 ni × 7)
 *     - 1 mes   = tarifa_neta × 13  (no × 22)
 *
 *   Si tarifa POR HORA (unidad_tarifa = 'hora'):
 *     - NO se muestra tab "día" (no aplica)
 *     - 1 sem   = tarifa_neta × 40 horas
 *     - 1 mes   = tarifa_neta × 150 horas
 *
 * Todos los totales con IVA incluido (19%).
 */

interface Props {
  maquinariaId: number;
  maquinariaNombre: string;
  /** Tarifa neta base por unidad (hora o día) */
  tarifaNeta: number;
  unidadTarifa: 'hora' | 'dia';
  minimoUnidades: number;
}

const IVA = 0.19;

type Periodo = 'dia' | 'semana' | 'mes';

interface Tier {
  key: Periodo;
  label: string;
  /** Unidades aplicadas (días si unidad=día, horas si unidad=hora) */
  unidades: number;
  /** Etiqueta humana del cálculo, ej "4 días" o "40 horas" */
  detalle: string;
  badge?: string;
}

// Tiers para máquinas tarifadas POR DÍA
const TIERS_DIA: Tier[] = [
  { key: 'dia', label: '1 día', unidades: 1, detalle: '1 día' },
  { key: 'semana', label: '1 semana', unidades: 4, detalle: '4 días', badge: 'mejor precio' },
  { key: 'mes', label: '1 mes', unidades: 13, detalle: '13 días', badge: 'mejor precio mes' },
];

// Tiers para máquinas tarifadas POR HORA — SIN día
const TIERS_HORA: Tier[] = [
  { key: 'semana', label: '1 semana', unidades: 40, detalle: '40 horas', badge: 'mejor precio' },
  { key: 'mes', label: '1 mes', unidades: 150, detalle: '150 horas', badge: 'mejor precio mes' },
];

function formatPriceMoney(value: number): string {
  return formatCLP(value);
}

export default function PricingTiers({
  maquinariaId,
  maquinariaNombre,
  tarifaNeta,
  unidadTarifa,
  minimoUnidades,
}: Props) {
  const tiers = unidadTarifa === 'hora' ? TIERS_HORA : TIERS_DIA;
  const defaultPeriodo: Periodo = unidadTarifa === 'hora' ? 'semana' : 'dia';
  const [activo, setActivo] = useState<Periodo>(defaultPeriodo);

  const calcular = (tier: Tier) => {
    // unidades del tier × tarifa_neta unitaria
    const subtotal = Math.round(tarifaNeta * tier.unidades);
    const iva = Math.round(subtotal * IVA);
    const total = subtotal + iva;
    return { subtotal, iva, total };
  };

  const tierActivo = tiers.find((t) => t.key === activo) ?? tiers[0];
  const calc = calcular(tierActivo);

  const unidadSingular = unidadTarifa === 'hora' ? 'hora' : 'día';

  return (
    <div className="bg-white hairline rounded-[16px] overflow-hidden">
      <div className="px-7 py-6 border-b border-[#EAEAEA]">
        <p className="eyebrow mb-2">Tarifas por período</p>
        <h3 className="font-[var(--font-serif)] text-2xl text-[#111111] tracking-tight">
          Mientras más largo, mejor precio
        </h3>
        <p className="text-sm text-[#787774] mt-2 max-w-[55ch] leading-relaxed">
          {unidadTarifa === 'hora'
            ? `Esta máquina se cotiza por hora. La semana es 40 h, el mes 150 h. Todo con IVA incluido.`
            : `Por día, por 4 días (semana) o por 13 días (mes). Todos los precios con IVA incluido.`}
        </p>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Período de arriendo" className="flex border-b border-[#EAEAEA]">
        {tiers.map((tier) => {
          const isActive = activo === tier.key;
          return (
            <button
              key={tier.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActivo(tier.key)}
              className={`flex-1 px-3 py-4 text-sm font-medium transition-spring relative tactile ${
                isActive ? 'text-[#111111] bg-white' : 'text-[#787774] bg-[#F7F6F3] hover:bg-[#F0EFEB]'
              }`}
            >
              <span className="block">{tier.label}</span>
              <span className="block text-[10px] text-[#787774] mt-0.5 tabular-nums">{tier.detalle}</span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#956400]" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Desglose */}
      <div className="p-7">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm text-[#787774]">Total {tierActivo.label.toLowerCase()}</span>
          <span className="font-[var(--font-serif)] text-3xl text-[#111111] tracking-tight tabular-nums">
            {formatPriceMoney(calc.total)}
          </span>
        </div>
        <div className="flex items-baseline justify-between mb-6">
          <span className="text-xs text-[#787774]">{tierActivo.detalle} a tarifa neta + IVA</span>
          <span className="text-sm text-[#956400] tabular-nums">
            {formatPriceMoney(Math.round(calc.total / tierActivo.unidades))} / {unidadSingular}
          </span>
        </div>

        <div className="space-y-2 text-sm text-[#787774] pb-5 border-b border-[#EAEAEA] mb-6">
          <div className="flex justify-between">
            <span>
              {tierActivo.detalle} × {formatPriceMoney(tarifaNeta)} neto
            </span>
            <span className="font-medium text-[#111111] tabular-nums">{formatPriceMoney(calc.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA (19%)</span>
            <span className="font-medium text-[#111111] tabular-nums">{formatPriceMoney(calc.iva)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={`/cotizar-arriendo?maquinariaId=${maquinariaId}&periodo=${tierActivo.key}`}
            className="group inline-flex items-center justify-center gap-3 px-5 py-3 bg-[#111111] hover:bg-[#2F3437] text-white text-sm font-semibold rounded-[10px] transition-spring tactile"
          >
            Cotizar {tierActivo.label.toLowerCase()}
            <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-spring" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href={whatsappCtaMaquinaria(maquinariaId, maquinariaNombre)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white hairline hover:bg-[#F7F6F3] text-[#111111] text-sm font-semibold rounded-[10px] transition-spring tactile"
          >
            Consultar por WhatsApp
          </a>
        </div>

        <p className="text-[11px] text-[#787774] mt-4 leading-relaxed">
          Precios indicativos por uso. El traslado se cotiza por aparte según dirección de
          obra. Para arriendos &gt; 1 mes o más de una máquina, pedí precio personalizado
          (ver opción de obra completa abajo).
        </p>
      </div>
    </div>
  );
}
