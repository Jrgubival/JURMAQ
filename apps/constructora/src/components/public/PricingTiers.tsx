'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatCLP } from '@jurmaq/shared/format';
import { whatsappCtaMaquinaria } from '@jurmaq/shared/whatsapp';

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
  dias: number;
  /** Multiplicador sobre tarifa diaria. 1 = sin descuento. */
  multiplicador: number;
  badge?: string;
}

const TIERS: Tier[] = [
  { key: 'dia', label: '1 día', dias: 1, multiplicador: 1.0 },
  { key: 'semana', label: '1 semana (5 días)', dias: 5, multiplicador: 0.92, badge: '8% off' },
  { key: 'mes', label: '1 mes (22 días)', dias: 22, multiplicador: 0.82, badge: '18% off' },
];

export default function PricingTiers({
  maquinariaId,
  maquinariaNombre,
  tarifaNeta,
  unidadTarifa,
  minimoUnidades,
}: Props) {
  const [activo, setActivo] = useState<Periodo>('dia');

  // Base diaria neta. Si la tarifa es por hora, asumimos 8h/día.
  const tarifaDiariaNeta =
    unidadTarifa === 'hora' ? tarifaNeta * 8 : tarifaNeta * Math.max(minimoUnidades, 1);

  const calcular = (tier: Tier) => {
    const subtotal = Math.round(tarifaDiariaNeta * tier.dias * tier.multiplicador);
    const iva = Math.round(subtotal * IVA);
    const total = subtotal + iva;
    const porDia = Math.round(total / tier.dias);
    return { subtotal, iva, total, porDia };
  };

  const tierActivo = TIERS.find((t) => t.key === activo)!;
  const calc = calcular(tierActivo);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
        <h3 className="text-lg font-bold text-navy-950">
          Tarifas por período
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Mientras más largo el arriendo, mejor precio por día. IVA incluido.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        {TIERS.map((tier) => (
          <button
            key={tier.key}
            type="button"
            onClick={() => setActivo(tier.key)}
            className={`flex-1 px-4 py-4 text-sm font-semibold transition-colors relative ${
              activo === tier.key
                ? 'text-navy-950 bg-white'
                : 'text-gray-500 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <span>{tier.label}</span>
            {tier.badge && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-700">
                {tier.badge}
              </span>
            )}
            {activo === tier.key && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-gold-500" />
            )}
          </button>
        ))}
      </div>

      {/* Desglose */}
      <div className="p-6">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-sm text-gray-600">Total {tierActivo.label.toLowerCase()}</span>
          <span className="text-3xl font-extrabold text-navy-950">
            {formatCLP(calc.total)}
          </span>
        </div>
        <div className="flex items-baseline justify-between mb-5">
          <span className="text-xs text-gray-500">Equivale a</span>
          <span className="text-sm font-semibold text-gold-600">
            {formatCLP(calc.porDia)}/día
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-600 pb-5 border-b border-gray-100 mb-5">
          <div className="flex justify-between">
            <span>Subtotal neto</span>
            <span className="font-medium text-navy-950">{formatCLP(calc.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA (19%)</span>
            <span className="font-medium text-navy-950">{formatCLP(calc.iva)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href={`/cotizar-arriendo?maquinaria=${maquinariaId}&dias=${tierActivo.dias}`}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm rounded-xl transition-colors"
          >
            Cotizar {tierActivo.label.toLowerCase()}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <a
            href={whatsappCtaMaquinaria(maquinariaId, maquinariaNombre)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-navy-950 hover:bg-navy-950 hover:text-white text-navy-950 font-bold text-sm rounded-xl transition-colors"
          >
            💬 Consultar por WhatsApp
          </a>
        </div>

        <p className="text-[11px] text-gray-500 mt-4 leading-relaxed">
          * Precios referenciales con descuentos por volumen estándar. El traslado se cotiza según
          dirección de obra. Para arriendos &gt; 1 mes ofrecemos descuentos adicionales.
        </p>
      </div>
    </div>
  );
}
