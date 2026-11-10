"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/barraca/Enlace";
import {
  CLAVE_CIERRE,
  CLAVE_COOKIES,
  avisoVigente,
  cierreVigente,
  cookiesPendientes,
  rutaSinAviso,
} from "@/lib/aviso-promo";

/**
 * Aviso de "ventas online": se monta en el layout, aparece una sola vez unos
 * segundos después de entrar y se acuerda del cierre por 7 días.
 *
 * - Sólo existe en el cliente tras la espera (position: fixed, sin CLS ni LCP).
 * - Espera al aviso de cookies: mientras CookieBanner esté abierto (no hay
 *   `consent_v2` válido) no sale; cuando se elige, CookieBanner dispara el
 *   evento `jurmaq:consent` y el aviso aparece 1,5 s después.
 * - Si el carrito, el menú del celular o el panel de filtros están abiertos
 *   (bloquean el scroll con la clase `overflow-hidden` o `style.overflow` en
 *   el body), reintenta cada 2 s.
 * - Reglas puras (fechas, rutas, 7 días) en lib/aviso-promo.ts.
 */

const ESPERA_MS = 4000;
const ESPERA_TRAS_COOKIES_MS = 1500;
const REINTENTO_MS = 2000;

const FOCALIZABLES = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function leerCierre(): string | null {
  try {
    return localStorage.getItem(CLAVE_CIERRE);
  } catch {
    return null;
  }
}

function guardarCierre() {
  try {
    localStorage.setItem(CLAVE_CIERRE, String(Date.now()));
  } catch {
    /* sin localStorage: el cierre vale sólo en memoria (yaMostrado) */
  }
}

function leerCookies(): string | null {
  try {
    return localStorage.getItem(CLAVE_COOKIES);
  } catch {
    return null;
  }
}

export default function AvisoVentasOnline() {
  const pathname = usePathname();
  const habilitado = !rutaSinAviso(pathname);
  const [abierto, setAbierto] = useState(false);
  const yaMostrado = useRef(false);
  const rutaAlAbrir = useRef<string | null>(null);
  const foco = useRef<HTMLElement | null>(null);
  const tarjeta = useRef<HTMLDivElement>(null);
  const botonPrincipal = useRef<HTMLAnchorElement>(null);
  const idTitulo = useId();
  const idTexto = useId();

  const cerrar = useCallback((devolverFoco: boolean) => {
    guardarCierre();
    setAbierto(false);
    if (devolverFoco) foco.current?.focus?.();
  }, []);

  // Programa la aparición.
  useEffect(() => {
    if (!habilitado || yaMostrado.current) return;
    if (!avisoVigente(Date.now()) || cierreVigente(leerCierre(), Date.now())) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let esperaCookies = cookiesPendientes(leerCookies());

    const programar = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(intentar, ms);
    };
    function intentar() {
      if (esperaCookies) return; // sigue el evento de cookies
      if (!avisoVigente(Date.now())) return;
      if (document.body.classList.contains("overflow-hidden") || document.body.style.overflow === "hidden") return programar(REINTENTO_MS);
      yaMostrado.current = true;
      foco.current = document.activeElement as HTMLElement | null;
      rutaAlAbrir.current = window.location.pathname;
      setAbierto(true);
    }
    const alElegirCookies = () => {
      if (!esperaCookies) return;
      esperaCookies = false;
      programar(ESPERA_TRAS_COOKIES_MS);
    };
    // "Configurar cookies" del pie vuelve a abrir el aviso de cookies.
    const alReabrirCookies = () => {
      esperaCookies = true;
    };

    window.addEventListener("jurmaq:consent", alElegirCookies);
    window.addEventListener("jurmaq:configurar-cookies", alReabrirCookies);
    programar(ESPERA_MS);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("jurmaq:consent", alElegirCookies);
      window.removeEventListener("jurmaq:configurar-cookies", alReabrirCookies);
    };
  }, [habilitado]);

  // Foco inicial en la acción principal.
  useEffect(() => {
    if (abierto) botonPrincipal.current?.focus();
  }, [abierto]);

  // Escape, y cierre si la persona navega a otra página.
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") cerrar(true);
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abierto, cerrar]);

  useEffect(() => {
    if (abierto && rutaAlAbrir.current !== null && pathname !== rutaAlAbrir.current) cerrar(false);
  }, [pathname, abierto, cerrar]);

  // Trampa de foco simple.
  const alTeclearEnTarjeta = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !tarjeta.current) return;
    const items = Array.from(tarjeta.current.querySelectorAll<HTMLElement>(FOCALIZABLES));
    if (items.length === 0) return;
    const primero = items[0];
    const ultimo = items[items.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };

  if (!abierto || !habilitado) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] [@media(max-width:639px)_and_(max-height:760px)]:pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:py-4">
      <div className="aviso-fondo absolute inset-0 bg-navy-950/40" onClick={() => cerrar(true)} aria-hidden="true" />
      <div
        ref={tarjeta}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        onKeyDown={alTeclearEnTarjeta}
        className="aviso-entra relative w-full max-w-[420px] rounded-xl border border-gray-200 bg-white px-4 pb-2 pt-4 [@media(max-width:639px)_and_(max-height:760px)]:pt-3 shadow-[0_8px_24px_-14px_rgba(12,29,58,0.3)] sm:px-6 sm:pb-4 sm:pt-6"
      >
        <button
          type="button"
          onClick={() => cerrar(true)}
          aria-label="Cerrar aviso"
          className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:text-navy-950 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-navy-950 sm:right-2 sm:top-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>

        <h2 id={idTitulo} className="pr-8 text-[17px] font-extrabold leading-[1.2] tracking-[-0.025em] text-navy-950 [@media(max-width:639px)_and_(max-height:760px)]:text-base sm:text-xl">
          Estamos partiendo con las ventas online
        </h2>
        <p id={idTexto} className="mt-1 text-[13.5px] leading-[1.4] text-gray-600 [@media(max-width:639px)_and_(max-height:760px)]:text-[13px] [@media(max-width:639px)_and_(max-height:760px)]:leading-[1.35] sm:mt-2 sm:text-[15px] sm:leading-normal">
          Por eso más de 900 productos tienen mejor precio en la web que en el local, hasta el 1 de diciembre.
        </p>

        <div className="mt-3 flex gap-2 [@media(max-width:639px)_and_(max-height:760px)]:mt-2 sm:mt-5">
          <Link
            ref={botonPrincipal}
            href="/categorias"
            onClick={() => cerrar(false)}
            className="flex h-10 flex-1 items-center justify-center rounded-lg bg-marca-600 px-3 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-marca-700 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950 sm:h-11"
          >
            Ver productos
          </Link>
          <button
            type="button"
            onClick={() => cerrar(true)}
            className="flex h-10 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-navy-950 transition-[border-color,transform] duration-150 ease-out hover:border-gray-400 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950 sm:h-11"
          >
            Seguir mirando
          </button>
        </div>

        <p className="text-[12px] leading-4 text-gray-500">
          <Link href="/terminos#5-precios" onClick={() => cerrar(false)} className="-mx-2 inline-flex h-11 items-center px-2 underline underline-offset-2 hover:text-navy-950">
            Condiciones
          </Link>
        </p>
      </div>
    </div>
  );
}
