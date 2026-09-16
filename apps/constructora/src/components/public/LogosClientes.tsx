import Image from 'next/image';
import { PROYECTOS } from '@/lib/proyectos-data';

/**
 * Franja de logos de mandantes.
 *
 * Antes la home listaba a Nestlé, Miguel Torres, Iansagro, Surfrut y Cementos
 * Biobío como TEXTO gris. Los logos ya estaban en `public/images/clientes/` y
 * declarados en `clienteLogo` de cada proyecto — simplemente no se usaban.
 *
 * Para un mandante industrial que evalúa contratistas, el logo reconocible
 * hace un trabajo que el texto no: se procesa de un vistazo y es lo que
 * legitima al proveedor. Es el activo de confianza más fuerte que tiene la
 * empresa y estaba desaprovechado.
 *
 * Decisiones:
 * - Los logos se sacan de PROYECTOS, no de una lista aparte: así solo puede
 *   aparecer un cliente que tenga una obra documentada detrás. Nada de
 *   "clientes" inventados.
 * - En reposo van en escala de grises al 70% de opacidad y recuperan color al
 *   pasar el mouse. Es lo estándar en sitios B2B y evita que cinco paletas de
 *   marca peleen con la del sitio.
 * - `unoptimized` en el SVG porque next/image no lo procesa; los demás pasan
 *   por el optimizador con `sizes` acotado.
 */

interface Props {
  titulo?: string;
  /** Fondo claro (default) u oscuro, para invertir el tratamiento. */
  variante?: 'claro' | 'oscuro';
}

export default function LogosClientes({
  titulo = 'Han confiado la obra a JURMAQ',
  variante = 'claro',
}: Props) {
  // Un logo por cliente único, en el orden en que aparecen los proyectos.
  const vistos = new Set<string>();
  const clientes = PROYECTOS.filter((p) => {
    if (!p.clienteLogo || vistos.has(p.cliente)) return false;
    vistos.add(p.cliente);
    return true;
  });

  if (clientes.length === 0) return null;

  const oscuro = variante === 'oscuro';

  return (
    <section
      aria-label="Mandantes"
      className={oscuro ? 'bg-navy-950' : 'bg-white border-b border-neutral-200'}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
        <p
          className={`text-[11px] uppercase tracking-[0.18em] font-semibold text-center ${
            oscuro ? 'text-white/50' : 'text-neutral-500'
          }`}
        >
          {titulo}
        </p>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-10 sm:gap-x-14 gap-y-8">
          {clientes.map((p) => (
            <li key={p.cliente} className="shrink-0">
              <Image
                src={p.clienteLogo!}
                alt={p.cliente}
                width={160}
                height={64}
                sizes="160px"
                unoptimized={p.clienteLogo!.endsWith('.svg')}
                className={`h-10 sm:h-12 w-auto object-contain transition-all duration-200 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 ${
                  oscuro ? 'brightness-0 invert hover:invert-0 hover:brightness-100' : ''
                }`}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
