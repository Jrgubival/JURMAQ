import type { TipoMaquinaSEO } from '@jurmaq/shared/seo';
import { Plus } from '@phosphor-icons/react/dist/ssr';

export function UsosYCaracteristicas({ tipo }: { tipo: TipoMaquinaSEO }) {
  return (
    <section className="bg-surface-alt">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 md:grid-cols-[1.3fr_1fr] md:px-8 md:py-20">
        <div>
          <h2 className="medio">Para qué se usa</h2>
          <ul className="mt-6 space-y-3 text-lg">
            {tipo.casosDeUso.map((c) => <li key={c} className="border-t border-negro/20 pt-3">{c}</li>)}
          </ul>
        </div>
        <div>
          <h2 className="medio">Características típicas</h2>
          <ul className="mt-6 space-y-2 text-ink-soft">
            {tipo.especificacionesClave.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Preguntas({ preguntas }: { preguntas: { q: string; a: string }[] }) {
  return (
    <section className="mx-auto max-w-[900px] px-4 py-14 md:py-20">
      <h2 className="medio">Preguntas frecuentes</h2>
      <div className="mt-6">
        {preguntas.map((p) => (
          <details key={p.q} className="border-t border-negro/20 last:border-b">
            <summary className="presionable flex min-h-16 items-center justify-between gap-4 py-4 text-lg font-semibold">{p.q}<Plus size={22} className="mas shrink-0" aria-hidden /></summary>
            <p className="pb-5 text-ink-soft">{p.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
