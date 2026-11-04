import Link from 'next/link';
import type { ComunaRental } from '@/data/comunas';
import { fichaHref, type Maquina } from '@/lib/maquinas';
import { PrecioCorto } from './Precios';
import Foto from './Foto';

/** Flota en el orden que más se pide en esa comuna: distinta en cada página. */
export function ordenarParaComuna(flota: Maquina[], comuna: ComunaRental): Maquina[] {
  const peso = (m: Maquina) => {
    const i = comuna.maquinas.indexOf(m.tipo);
    return i < 0 ? 99 : i;
  };
  return [...flota].sort((a, b) => peso(a) - peso(b));
}

export function TrabajosComuna({ comuna, km, tiempo = null, vecinas = [] }: { comuna: ComunaRental; km: number | null; tiempo?: string | null; vecinas?: ComunaRental[] }) {
  return (
    <section className="bg-surface-alt">
      <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-14 md:grid-cols-2 md:px-8 md:py-20">
        <div>
          <h2 className="medio">Trabajos típicos en {comuna.nombre}</h2>
          {km ? <p className="mt-4 text-lg">Unos {km} km desde nuestra base en Maquehua{tiempo ? `, cerca de ${tiempo} en camión` : ''}. El traslado se cotiza aparte.</p> : null}
          {comuna.nota ? <p className="mt-4 text-lg font-medium">{comuna.nota}</p> : null}
          {vecinas.length > 0 ? (
            <p className="mt-4 text-lg">También arrendamos en {vecinas.map((v, i) => (
              <span key={v.slug}>{i > 0 ? ', ' : ''}<Link href={`/arriendo-en/${v.slug}`} prefetch={false} className="underline underline-offset-4">{v.nombre}</Link></span>
            ))}.</p>
          ) : null}
        </div>
        <ul>
          {comuna.trabajos.map((t) => <li key={t} className="border-t border-negro/25 py-4 font-titulo text-[clamp(1.375rem,2.4vw,1.75rem)] font-semibold leading-tight">{t}</li>)}
        </ul>
      </div>
    </section>
  );
}

/** Lista con foto: formato distinto al mosaico del catálogo. */
export function FlotaComuna({ flota, titulo }: { flota: Maquina[]; titulo: string }) {
  const [primera, ...resto] = flota;
  if (!primera) return null;
  return (
    <section className="mx-auto max-w-[1320px] px-4 py-14 md:px-8 md:py-20">
      <h2 className="medio">{titulo}</h2>
      <div className="mt-6 grid gap-8 md:grid-cols-[1.3fr_1fr]">
        <Link href={fichaHref(primera)} prefetch={false} className="tile presionable block">
          <Foto maquina={primera} className="aspect-[4/3]" />
          <h3 className="mt-3 text-3xl">{primera.nombre}</h3>
          <div className="mt-1 flex flex-wrap gap-x-4 text-ink-soft"><PrecioCorto precios={primera.precios} /></div>
        </Link>
        <ul className="grid content-start gap-3">
          {resto.map((m) => (
            <li key={m.id}>
              <Link href={fichaHref(m)} prefetch={false} className="tile presionable grid grid-cols-[136px_1fr] items-center gap-4">
                <Foto maquina={m} className="aspect-[4/3] [&>span]:text-[0.625rem]" />
                <span><span className="block font-titulo text-xl font-semibold leading-tight">{m.nombre}</span><PrecioCorto precios={m.precios} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-sm text-ink-muted">Valores referenciales y netos.</p>
    </section>
  );
}
