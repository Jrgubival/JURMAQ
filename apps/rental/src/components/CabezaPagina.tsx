import Migas from './Migas';

/** Banda oscura de las páginas interiores: misma voz que las portadas. */
export default function CabezaPagina({ migas, titulo, bajada }: { migas: { nombre: string; href?: string }[]; titulo: string; bajada?: string }) {
  return (
    <div className="bg-negro text-white">
      <div className="mx-auto max-w-[1320px] px-4 py-8 md:px-8 md:py-14">
        <Migas items={migas} />
        <h1 className="grande mt-4 max-w-[18ch]">{titulo}</h1>
        {bajada ? <p className="mt-4 max-w-[58ch] text-lg text-white/80">{bajada}</p> : null}
      </div>
    </div>
  );
}
