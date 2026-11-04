import type { Maquina } from '@/lib/maquinas';
import { AccionesContacto } from './AccionesContacto';
import { variantes } from './Foto';
import Migas from './Migas';

/** Portada de landing: foto de la flota a lo ancho y titular grande. */
export default function PortadaLanding({ migas, titulo, bajada, foto, cotizar, texto, children, angosta = false }: {
  migas: { nombre: string; href?: string }[];
  titulo: string;
  bajada: string;
  foto?: Maquina;
  cotizar: string;
  texto: string;
  children?: React.ReactNode;
  /** Foto de poca resolución: en escritorio ocupa sólo media portada. */
  angosta?: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-negro text-white">
      {foto?.fotos[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto.fotos[0]} alt={foto.nombre} {...variantes(foto.fotos[0], '100vw')} width={1600} height={900} fetchPriority="high" className={`foto-hero absolute inset-0 -z-20 h-full w-full object-cover ${angosta ? 'md:left-auto md:right-0 md:w-1/2' : ''}`} />
      ) : null}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-negro/95 via-negro/70 to-negro/35 md:bg-gradient-to-r md:from-negro/90 md:via-negro/60 md:to-negro/10" />
      {foto?.fotoReferencial ? <span className="absolute bottom-3 right-3 bg-negro/75 px-2 py-1 text-xs">Imagen referencial</span> : null}
      <div className="mx-auto max-w-[1320px] px-4 pb-12 pt-10 md:px-8 md:pb-20 md:pt-14">
        <Migas items={migas} />
        <h1 className="entra mt-16 max-w-[18ch] text-[clamp(1.875rem,9vw,2.25rem)] md:text-[clamp(2.5rem,4.4vw,3.5rem)] leading-[1.08] md:mt-24">{titulo}</h1>
        <p className="entra mt-5 max-w-[52ch] text-lg text-white/85" style={{ '--i': 1 } as React.CSSProperties}>{bajada}</p>
        {children}
        <div className="entra mt-7 hidden md:block" style={{ '--i': 2 } as React.CSSProperties}><AccionesContacto cotizar={cotizar} texto={texto} /></div>
      </div>
    </section>
  );
}
