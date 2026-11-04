'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ENLACES } from '@/lib/enlaces';
import { SITIO } from '@/lib/sitio';

export default function Menu() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        className="presionable relative z-30 flex h-12 w-12 items-center justify-center"
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={abierto}
        aria-controls="menu-movil"
        onClick={() => setAbierto((a) => !a)}
      >
        <span aria-hidden className="relative block h-3.5 w-6">
          <span className={`absolute left-0 h-0.5 w-6 bg-white transition-transform duration-200 ${abierto ? 'top-1.5 rotate-45' : 'top-0'}`} />
          <span className={`absolute left-0 h-0.5 w-6 bg-white transition-transform duration-200 ${abierto ? 'top-1.5 -rotate-45' : 'top-3'}`} />
        </span>
      </button>
      <nav
        id="menu-movil"
        className="cajon fixed inset-x-0 top-0 z-20 bg-negro px-4 pb-8 pt-20 text-white"
        data-abierto={abierto}
        aria-label="Principal"
        inert={!abierto}
      >
        <ul>
          {ENLACES.map((e) => (
            <li key={e.href}>
              <Link href={e.href} prefetch={false} className="presionable block py-3 font-titulo text-3xl" onClick={() => setAbierto(false)}>
                {e.texto}
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/cotizar-arriendo" prefetch={false} className="boton boton-principal mt-6 w-full" onClick={() => setAbierto(false)}>Cotizar</Link>
        <a href={`tel:${SITIO.telefono}`} className="boton boton-secundario mt-2 w-full">Llamar {SITIO.telefonoVisible}</a>
      </nav>
    </div>
  );
}
