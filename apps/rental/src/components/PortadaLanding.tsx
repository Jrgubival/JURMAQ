import type { Maquina } from '@/lib/maquinas';
import { AccionesContacto } from './AccionesContacto';
import Migas from './Migas';

/** Portada de landing: foto de la flota a lo ancho y titular grande. */
export default function PortadaLanding({ migas, titulo, bajada, foto, cotizar, texto, children }: {
  migas: { nombre: string; href?: string }[];
  titulo: string;
  bajada: string;
  foto?: Maquina;
  cotizar: string;
  texto: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-negro text-white">
      {foto?.fotos[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto.fotos[0]} alt={foto.nombre} width={1600} height={900} fetchPriority="high" className="foto-hero absolute inset-0 -z-20 h-full w-full object-cover" />
      ) : null}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/95 via-black/70 to-black/35 md:bg-gradient-to-r md:from-black/90 md:via-black/60 md:to-black/10" />
      {foto?.fotoReferencial ? <span className="absolute right-3 top-3 bg-negro/75 px-2 py-1 text-xs">Imagen referencial</span> : null}
      <div className="mx-auto max-w-[1320px] px-4 pb-12 pt-6 md:px-8 md:pb-20">
        <Migas items={migas} />
        <h1 className="entra mt-16 max-w-[16ch] text-[clamp(2.75rem,7.4vw,6rem)] leading-[1.04] md:mt-24">{titulo}</h1>
        <p className="entra mt-5 max-w-[52ch] text-lg text-white/85" style={{ '--i': 1 } as React.CSSProperties}>{bajada}</p>
        {children}
        <div className="entra mt-7 hidden md:block" style={{ '--i': 2 } as React.CSSProperties}><AccionesContacto cotizar={cotizar} texto={texto} /></div>
      </div>
    </section>
  );
}
