'use client';

import { useEffect, useState } from 'react';

interface Bloque {
  desde: string;
  hasta: string;
  tipo: 'mantencion' | 'contrato' | 'cotizacion';
}

interface DispoResp {
  bloques: Bloque[];
  primera_fecha_libre: string;
  desde: string;
  hasta: string;
}

/**
 * Calendario compacto de disponibilidad para `/maquinarias/[id]`.
 *
 * Muestra próximos 30 días. Día verde = libre, gris = ocupado, hover = motivo.
 * Sirve para que el cliente confirme antes de cotizar.
 */
export default function DisponibilidadCalendario({ maquinariaId }: { maquinariaId: number }) {
  const [data, setData] = useState<DispoResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
        const hasta = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
        const res = await fetch(
          `/api/public/maquinarias/${maquinariaId}/disponibilidad?desde=${hoy}&hasta=${hasta}`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          setError(`Error ${res.status}`);
          return;
        }
        const json = (await res.json()) as DispoResp;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [maquinariaId]);

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        No pudimos cargar la disponibilidad. Igual puedes cotizar.
      </div>
    );
  }
  if (!data) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-500">
        Cargando disponibilidad…
      </div>
    );
  }

  const dias = construirGrid(data.desde, 30, data.bloques);
  const primeraLibre = data.primera_fecha_libre;
  const primeraLibreFmt = primeraLibre
    ? new Date(primeraLibre).toLocaleDateString('es-CL', {
        day: 'numeric',
        month: 'long',
      })
    : null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Próximos 30 días</h3>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-200" /> Libre
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-orange-300" /> Ocupada
          </span>
        </div>
      </div>

      <div className="grid grid-cols-10 sm:grid-cols-15 gap-1 mb-3" role="list">
        {dias.map((d) => (
          <div
            key={d.fecha}
            role="listitem"
            title={`${d.fechaFmt}${d.ocupado ? ` (${d.tipo})` : ' — disponible'}`}
            className={`aspect-square rounded text-[10px] font-medium text-center flex flex-col items-center justify-center cursor-default ${
              d.ocupado
                ? 'bg-orange-300 text-orange-900'
                : 'bg-green-200 text-green-900'
            }`}
          >
            <div className="leading-none">{d.dia}</div>
            <div className="text-[8px] opacity-70 leading-none mt-0.5">{d.mesAbrev}</div>
          </div>
        ))}
      </div>

      {primeraLibreFmt && (
        <div className="text-xs text-gray-700">
          ✓ Disponible desde <strong>{primeraLibreFmt}</strong>
        </div>
      )}
    </div>
  );
}

interface DiaGrid {
  fecha: string;
  fechaFmt: string;
  dia: number;
  mesAbrev: string;
  ocupado: boolean;
  tipo?: string;
}

function construirGrid(desdeISO: string, cantidadDias: number, bloques: Bloque[]): DiaGrid[] {
  const inicio = new Date(desdeISO);
  const dias: DiaGrid[] = [];
  for (let i = 0; i < cantidadDias; i++) {
    const d = new Date(inicio.getTime() + i * 24 * 60 * 60 * 1000);
    const iso = d.toISOString().slice(0, 10);
    const bloque = bloques.find((b) => iso >= b.desde && iso <= b.hasta);
    dias.push({
      fecha: iso,
      fechaFmt: d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }),
      dia: d.getDate(),
      mesAbrev: d.toLocaleDateString('es-CL', { month: 'short' }).slice(0, 3),
      ocupado: !!bloque,
      tipo: bloque?.tipo,
    });
  }
  return dias;
}
