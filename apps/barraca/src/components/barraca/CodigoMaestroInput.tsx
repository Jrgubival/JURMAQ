'use client';

import { useEffect, useState } from 'react';

/**
 * Componente reusable para ingresar / validar el código de maestro referido.
 *
 * - Hidrata desde `localStorage.barraca_maestro_codigo` (set en /maestros/[codigo]).
 * - Valida vía POST /api/public/maestros/validar.
 * - Notifica al parent vía `onChange({ maestro_id, codigo, nombre } | null)`.
 *
 * Tier 2 B1: usado en /carrito y /cotizar (formulario de checkout).
 */
interface MaestroInfo {
  maestro_id: string;
  codigo: string;
  nombre: string;
}

interface Props {
  /** Llama cuando el código se aplica o se quita. */
  onChange?: (maestro: MaestroInfo | null) => void;
  /** ClassName del wrapper para que el parent ajuste spacing. */
  className?: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'applied'; info: MaestroInfo }
  | { kind: 'error'; msg: string };

const STORAGE_KEY = 'barraca_maestro_codigo';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export default function CodigoMaestroInput({ onChange, className = '' }: Props) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });

  // Hidratar desde localStorage (set por /maestros/[codigo]).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { codigo?: string; nombre?: string; _set_at?: number };
      if (!parsed?.codigo) return;
      const age = Date.now() - (parsed._set_at || 0);
      if (age > TTL_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      // Auto-validar al cargar para confirmar que sigue activo + obtener maestro_id.
      setInput(parsed.codigo);
      void validar(parsed.codigo);
    } catch {
      // Ignorar localStorage parse errors.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function validar(codigo: string) {
    const c = codigo.toUpperCase().trim();
    if (!/^MAE-[0-9]{4}-[0-9]+$/.test(c)) {
      setState({ kind: 'error', msg: 'Formato inválido (esperado: MAE-AAAA-NNN)' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/public/maestros/validar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: c }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setState({ kind: 'error', msg: data.error || 'Código no encontrado' });
        onChange?.(null);
        return;
      }
      const info: MaestroInfo = {
        maestro_id: data.maestro_id,
        codigo: data.codigo,
        nombre: data.nombre,
      };
      setState({ kind: 'applied', info });
      onChange?.(info);
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ codigo: info.codigo, nombre: info.nombre, _set_at: Date.now() }),
        );
      } catch {
        // bloqueado/full, no es crítico.
      }
    } catch (err) {
      setState({ kind: 'error', msg: err instanceof Error ? err.message : 'Error de red' });
      onChange?.(null);
    }
  }

  function quitar() {
    setState({ kind: 'idle' });
    setInput('');
    onChange?.(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  if (state.kind === 'applied') {
    return (
      <div className={className}>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center justify-between gap-2">
          <div className="text-xs">
            <span className="font-mono font-semibold text-blue-800">{state.info.codigo}</span>
            <span className="text-blue-700"> · Maestro: {state.info.nombre}</span>
          </div>
          <button
            type="button"
            onClick={quitar}
            className="text-xs text-red-600 hover:underline"
          >
            Quitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <details className="text-sm">
        <summary className="text-xs text-orange-600 hover:underline cursor-pointer">
          🔧 ¿Te recomendó un maestro? (código MAE-AAAA-NNN)
        </summary>
        <div className="mt-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              placeholder="MAE-2026-001"
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono uppercase"
              maxLength={20}
            />
            <button
              type="button"
              onClick={() => validar(input)}
              disabled={state.kind === 'loading' || !input}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded"
            >
              {state.kind === 'loading' ? '…' : 'Validar'}
            </button>
          </div>
          {state.kind === 'error' && (
            <p className="text-xs text-red-600 mt-1">{state.msg}</p>
          )}
          <p className="text-xs text-gray-500 mt-1.5">
            Apoyas a tu maestro de confianza sin costo adicional para ti.
          </p>
        </div>
      </details>
    </div>
  );
}
