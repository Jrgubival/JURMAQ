import Link from 'next/link';
import { FranjaGrupo } from '@jurmaq/shared/ui/grupo';
import { SITIO, PRIVACIDAD_URL, TERMINOS_URL } from '@/lib/sitio';

export default function Pie({ tipos, comunas }: { tipos: { slug: string; nombre: string }[]; comunas: { slug: string; nombre: string }[] }) {
  return (
    <footer className="bg-negro pb-24 text-white/70 md:pb-0">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-4 py-14 text-[0.9375rem] md:grid-cols-[1.3fr_1fr_1.5fr_1.2fr] md:px-8">
        <div>
          <p className="flex items-baseline">
            <span className="text-2xl font-extrabold tracking-tight text-white">JURMAQ</span>
            <span className="ml-1 text-lg font-semibold text-acento">Arriendo</span>
          </p>
          <p className="mt-3 max-w-[26ch]">Arriendo de maquinaria en la Región del Maule desde {SITIO.anioInicio}.</p>
        </div>
        <div>
          <p className="font-semibold text-white">Máquinas</p>
          <ul className="mt-2">
            {tipos.map((t) => <li key={t.slug}><Link href={`/arriendo/${t.slug}`} prefetch={false} className="inline-flex min-h-11 items-center hover:text-white">{t.nombre}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white">Comunas</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4">
            {comunas.map((c) => <li key={c.slug}><Link href={`/arriendo-en/${c.slug}`} prefetch={false} className="inline-flex min-h-11 items-center hover:text-white">{c.nombre}</Link></li>)}
          </ul>
        </div>
        <address className="not-italic">
          <p className="font-semibold text-white">Contacto</p>
          <p className="mt-1"><a href={`tel:${SITIO.telefono}`} className="inline-flex min-h-11 items-center hover:text-white">{SITIO.telefonoVisible}</a></p>
          <p><a href={`mailto:${SITIO.correo}`} className="inline-flex min-h-11 items-center hover:text-white">{SITIO.correo}</a></p>
          <p className="mt-2">{SITIO.direccion}</p>
        </address>
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-[1320px] flex-wrap justify-between gap-3 px-4 py-5 text-sm md:px-8">
          <p>{SITIO.razonSocial}, RUT {SITIO.rut}</p>
          <p className="flex gap-5">
            <a href={TERMINOS_URL} className="hover:text-white">Términos</a>
            <a href={PRIVACIDAD_URL} className="hover:text-white">Privacidad</a>
          </p>
        </div>
      </div>
      <FranjaGrupo actual="arriendo" />
    </footer>
  );
}
