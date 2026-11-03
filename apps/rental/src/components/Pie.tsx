import Link from 'next/link';
import { SITIO, PRIVACIDAD_URL, TERMINOS_URL } from '@/lib/sitio';

export default function Pie({ tipos }: { tipos: { slug: string; nombre: string }[] }) {
  return (
    <footer className="mt-16 border-t border-hairline bg-surface-alt pb-24 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-ink-soft sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-titulo text-xl font-semibold text-ink">JURMAQ Rental</p>
          <p className="mt-2">Arriendo de maquinaria en la Región del Maule desde {SITIO.anioInicio}.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Máquinas</p>
          <ul className="mt-2 space-y-1">
            {tipos.map((t) => (
              <li key={t.slug}>
                <Link href={`/arriendo/${t.slug}`} prefetch={false} className="hover:underline">
                  {t.nombre}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink">Dónde</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/arriendo-en/curico" prefetch={false} className="hover:underline">Curicó</Link></li>
            <li><Link href="/arriendo-en/molina" prefetch={false} className="hover:underline">Molina</Link></li>
            <li><Link href="/arriendo-en/talca" prefetch={false} className="hover:underline">Talca</Link></li>
            <li><Link href="/arriendo-en/region-del-maule" prefetch={false} className="hover:underline">Región del Maule</Link></li>
          </ul>
        </div>
        <address className="not-italic">
          <p className="font-semibold text-ink">Contacto</p>
          <p className="mt-2"><a href={`tel:${SITIO.telefono}`} className="hover:underline">{SITIO.telefonoVisible}</a></p>
          <p><a href={`mailto:${SITIO.correo}`} className="hover:underline">{SITIO.correo}</a></p>
          <p className="mt-2">{SITIO.direccion}</p>
        </address>
      </div>
      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-xs text-ink-muted">
          <p>{SITIO.razonSocial} · RUT {SITIO.rut}</p>
          <p className="flex gap-4">
            <a href={TERMINOS_URL} className="hover:underline">Términos</a>
            <a href={PRIVACIDAD_URL} className="hover:underline">Privacidad</a>
            <a href="https://jurmaq.cl" className="hover:underline">Grupo JURMAQ</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
