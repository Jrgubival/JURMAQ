import type { Maquina } from '@/lib/maquinas';
import { AccionesContacto } from './AccionesContacto';
import { heroAncho, variantesHero } from './Foto';
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
  // Una foto sin versión de 2400 px nunca se estira a todo el ancho: va dividida.
  const dividida = angosta || !heroAncho(foto?.fotos[0]);
  return (
    <section className="relative isolate overflow-hidden bg-negro text-white">
      {foto?.fotos[0] ? (
        // La foto angosta se funde con el marino: sin borde duro entre panel y foto.
        <div className={`absolute inset-0 -z-20 overflow-hidden ${dividida ? 'md:left-auto md:w-[60%] md:[mask-image:linear-gradient(to_right,transparent,black_38%)]' : ''}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto.fotos[0]} alt={foto.nombre} {...variantesHero(foto.fotos[0], dividida ? '(min-width: 768px) 60vw, 100vw' : '100vw')} width={1600} height={900} fetchPriority="high" className="foto-hero h-full w-full object-cover" />
        </div>
      ) : null}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-negro/95 via-negro/70 to-negro/35 md:bg-gradient-to-r md:from-negro md:via-negro/70 md:to-negro/10" />
      {foto?.fotoReferencial ? <span className="absolute bottom-3 right-3 rounded-full bg-negro/70 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">Imagen referencial</span> : null}
      <div className="mx-auto max-w-[1320px] px-4 pb-12 pt-10 md:px-8 md:pb-20 md:pt-14">
        <Migas items={migas} />
        <h1 className="entra mt-16 max-w-[18ch] md:max-w-[min(18ch,46vw)] text-[clamp(1.875rem,9vw,2.25rem)] md:text-[clamp(2.5rem,4.4vw,3.5rem)] leading-[1.08] md:mt-24">{titulo}</h1>
        <p className="entra mt-6 max-w-[52ch] text-lg text-white/85 md:max-w-[min(52ch,46vw)]" style={{ '--i': 1 } as React.CSSProperties}>{bajada}</p>
        {children}
        <div className="entra mt-7 hidden md:block" style={{ '--i': 2 } as React.CSSProperties}><AccionesContacto cotizar={cotizar} texto={texto} /></div>
      </div>
    </section>
  );
}
