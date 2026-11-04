import { formatCLP } from '@jurmaq/shared/format';
import { UNIDAD_LABEL, type PrecioPeriodo } from '@/lib/maquinas';

export function PrecioCorto({ precios }: { precios: PrecioPeriodo[] }) {
  const p = precios[0];
  if (!p) return <p className="font-titulo text-xl">Cotizar</p>;
  return (
    <p className="font-titulo text-xl tabular-nums">
      {formatCLP(p.valor)} <span className="font-sans text-sm font-normal">+ IVA / {UNIDAD_LABEL[p.unidad].uno}</span>
    </p>
  );
}

export function TablaPrecios({ precios }: { precios: PrecioPeriodo[] }) {
  if (precios.length === 0) return <p className="text-lg text-ink-soft">Esta máquina se cotiza caso a caso.</p>;
  const [principal, ...resto] = precios;
  return (
    <div>
      <div className="rounded-[12px] bg-negro p-6 text-white">
        <p className="text-[0.9375rem] text-white/75">Por {UNIDAD_LABEL[principal.unidad].uno}</p>
        <p className="mt-2 font-titulo text-[clamp(2.25rem,4.4vw,3rem)] leading-none tabular-nums">{formatCLP(principal.valor)}</p>
        <p className="mt-2 text-[0.9375rem] text-white/75">+ IVA{principal.incluye ? `. ${principal.incluye}` : ''}</p>
      </div>
      {resto.length > 0 ? (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {resto.map((p) => (
            <li key={p.unidad} className="rounded-[12px] border border-hairline bg-surface p-4">
              <p className="text-sm text-ink-muted">Por {UNIDAD_LABEL[p.unidad].uno}</p>
              <p className="mt-1 font-titulo text-2xl tabular-nums">{formatCLP(p.valor)}</p>
              <p className="text-sm text-ink-muted">+ IVA{p.incluye ? `. ${p.incluye}` : ''}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-4 text-sm text-ink-muted">Valores referenciales. El traslado se cotiza aparte.</p>
    </div>
  );
}
