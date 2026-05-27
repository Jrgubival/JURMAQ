"use client"

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
 * Display: SOLO valores netos. El IVA se agrega en la cotización formal
 * (post-wizard), no en la página pública.
 */

interface Props {
  maquinariaId: number;
  maquinariaNombre: string;
  /** Tarifa neta base por unidad (hora o día) */
  tarifaNeta: number;
  unidadTarifa: 'hora' | 'dia';
  minimoUnidades: number;
}

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

// Tiers para máquinas tarifadas POR DÍA — incluye DÍA + SEMANA + MES.
//
// IMPORTANTE: 4 días y 13 días NO son los días REALES de una semana/mes (serían
// 5-7 días y 20-22 días). Son EQUIVALENCIAS-PRECIO — el cliente paga "lo de"
// 4 días por una semana completa, no por 5 ni 7. Mismo patrón que TIERS_HORA.
const TIERS_DIA: Tier[] = [
  { key: 'dia', label: '1 día', unidades: 1, detalle: 'tarifa base' },
  { key: 'semana', label: 'Semana', unidades: 4, detalle: 'pagás 4 días · ahorrás 1-3', badge: 'ahorro vs 5-7 días' },
  { key: 'mes', label: 'Mes', unidades: 13, detalle: 'pagás 13 días · ahorrás 7-9', badge: 'ahorro vs 20-22 días' },
];

// Tiers para máquinas tarifadas POR HORA — incluye HORA + SEMANA + MES.
//
// IMPORTANTE: 40h y 150h NO son las horas REALES de una semana/mes (serían 42h
// y 168h respectivamente). Son EQUIVALENCIAS-PRECIO — el cliente paga "lo de"
// 40h por una semana completa, no por 42h. Y "lo de" 150h por un mes completo,
// no por 168h. Es el descuento por plazo largo de JURMAQ.
const TIERS_HORA: Tier[] = [
  { key: 'dia', label: '1 hora', unidades: 1, detalle: 'tarifa base' },
  { key: 'semana', label: 'Semana', unidades: 40, detalle: 'pagás 40h · ahorrás 2h', badge: 'ahorro vs 42h' },
  { key: 'mes', label: 'Mes', unidades: 150, detalle: 'pagás 150h · ahorrás 18h', badge: 'ahorro vs 168h' },
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
  // Default: 'dia' siempre (= "1 hora" para tarifa hora, = "1 día" para tarifa día)
  const [activo, setActivo] = useState<Periodo>('dia');

  const calcular = (tier: Tier) => {
    // unidades del tier × tarifa_neta unitaria — sin IVA en UI pública
    const subtotal = Math.round(tarifaNeta * tier.unidades);
    return { subtotal };
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
            ? `Esta máquina se cotiza por hora. La semana real son 42 h pero pagás solo 40, el mes son 168 h pero pagás solo 150 — descuento por plazo. Valores netos.`
            : `Por día, semana (equivalente a 4 días) o mes (equivalente a 13 días). A mayor plazo, mejor precio. Valores netos.`}
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
            {formatPriceMoney(calc.subtotal)}
          </span>
        </div>
        <div className="flex items-baseline justify-between mb-6">
          <span className="text-xs text-[#787774]">{tierActivo.detalle}</span>
          <span className="text-sm text-[#956400] tabular-nums">
            {formatPriceMoney(Math.round(calc.subtotal / tierActivo.unidades))} / {unidadSingular}
          </span>
        </div>

        <div className="space-y-2 text-sm text-[#787774] pb-5 border-b border-[#EAEAEA] mb-6">
          <div className="flex justify-between">
            <span>
              Tarifa unitaria neta
            </span>
            <span className="font-medium text-[#111111] tabular-nums">{formatPriceMoney(tarifaNeta)}</span>
          </div>
          <div className="flex justify-between">
            <span>Período seleccionado</span>
            <span className="font-medium text-[#111111] tabular-nums">{tierActivo.unidades} × tarifa</span>
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
