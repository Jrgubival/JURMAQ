import { formatCLP } from '@jurmaq/shared/format';
import { UNIDAD_LABEL, type PrecioPeriodo } from '@/lib/maquinas';

export function PrecioCorto({ precios }: { precios: PrecioPeriodo[] }) {
  const p = precios[0];
  if (!p) return <p className="font-semibold">Cotizar</p>;
  return (
    <p>
      <span className="font-semibold">{formatCLP(p.valor)}</span>{' '}
      <span className="text-sm text-ink-muted">+ IVA / {UNIDAD_LABEL[p.unidad].uno}</span>
    </p>
  );
}

export function TablaPrecios({ precios }: { precios: PrecioPeriodo[] }) {
  if (precios.length === 0) {
    return <p className="text-ink-soft">Esta máquina se cotiza caso a caso.</p>;
  }
  return (
    <div>
      <ul className="divide-y divide-hairline border-y border-hairline">
        {precios.map((p) => (
          <li key={p.unidad} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <div>
              <p className="font-medium capitalize">Por {UNIDAD_LABEL[p.unidad].uno}</p>
              {p.incluye ? <p className="text-sm text-ink-muted">{p.incluye}</p> : null}
            </div>
            <p className="font-titulo text-2xl font-semibold">
              {formatCLP(p.valor)} <span className="font-sans text-sm font-normal text-ink-muted">+ IVA</span>
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-ink-muted">Valores referenciales. El traslado se cotiza aparte.</p>
    </div>
  );
}
