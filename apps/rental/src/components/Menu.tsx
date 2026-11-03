'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ENLACES } from '@/lib/enlaces';

export default function Menu() {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        className="boton boton-suave relative z-30"
        aria-expanded={abierto}
        aria-controls="menu-movil"
        onClick={() => setAbierto((a) => !a)}
      >
        {abierto ? 'Cerrar' : 'Menú'}
      </button>
      <nav
        id="menu-movil"
        className="cajon fixed inset-x-0 top-0 z-20 border-b border-hairline bg-surface px-4 pb-6 pt-20"
        data-abierto={abierto}
        aria-label="Principal"
        inert={!abierto}
      >
        <ul>
          {ENLACES.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                prefetch={false}
                className="presionable block border-b border-hairline py-4 text-lg font-medium"
                onClick={() => setAbierto(false)}
              >
                {e.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
