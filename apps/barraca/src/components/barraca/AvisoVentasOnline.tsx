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
      <div className="aviso-fondo absolute inset-0 bg-navy-950/55" onClick={() => cerrar(true)} aria-hidden="true" />
      <div
        ref={tarjeta}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idTexto}
        onKeyDown={alTeclearEnTarjeta}
        className="aviso-entra relative flex w-full max-w-[420px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_18px_44px_-16px_rgba(12,29,58,0.55)] sm:max-w-[760px] sm:flex-row"
      >
        <button
          type="button"
          onClick={() => cerrar(true)}
          aria-label="Cerrar aviso"
          className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-navy-950/60 text-white transition-colors duration-150 hover:bg-navy-950/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:bg-transparent sm:text-gray-500 sm:hover:bg-gray-100 sm:hover:text-navy-950 sm:focus-visible:outline-navy-950"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
          </svg>
        </button>

        {/* Foto de la bodega con el titular pegado abajo, sobre un degradado azul. */}
        <div className={`relative h-[200px] shrink-0 overflow-hidden border-b-4 border-marca-600 bg-navy-950 [@media(max-width:639px)_and_(max-height:700px)]:h-[148px] sm:h-auto sm:w-[44%] sm:border-b-0 sm:border-r-4`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/aviso-bodega-perfiles.webp"
            alt=""
            width={640}
            height={712}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[50%_38%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/75 to-navy-950/5 sm:via-navy-950/70 sm:to-navy-950/10" aria-hidden="true" />
          <h2
            id={idTitulo}
            className={`absolute inset-x-0 bottom-0 px-4 pb-3.5 pr-12 text-[25px] font-extrabold leading-[1.04] tracking-[-0.03em] text-white [@media(max-width:639px)_and_(max-height:700px)]:pb-2.5 [@media(max-width:639px)_and_(max-height:700px)]:text-[21px] sm:px-6 sm:pb-6 sm:pr-6 sm:text-[34px] sm:leading-[1.02]`}
          >
            Estamos recién partiendo con la venta en línea
          </h2>
        </div>

        <div className="px-4 pb-1 pt-3.5 sm:flex sm:flex-1 sm:flex-col sm:justify-center sm:px-8 sm:pb-6 sm:pt-12">
          <p id={idTexto} className={`text-[14px] leading-[1.4] text-gray-700 [@media(max-width:639px)_and_(max-height:700px)]:text-[13px] [@media(max-width:639px)_and_(max-height:700px)]:leading-[1.35] sm:text-[16px] sm:leading-normal`}>
            Por eso, hasta el 1 de diciembre, comprar en la página sale más barato que en el local. Más de 900 productos con precio web.
          </p>

          <div className={`mt-3 flex gap-2 [@media(max-width:639px)_and_(max-height:700px)]:mt-2 sm:mt-6`}>
            <Link
              ref={botonPrincipal}
              href="/categorias"
              onClick={() => cerrar(false)}
              className="flex h-11 flex-[1.4] items-center justify-center rounded-lg bg-marca-600 px-3 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-marca-700 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950"
            >
              Ver precios web
            </Link>
            <button
              type="button"
              onClick={() => cerrar(true)}
              className="flex h-11 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-navy-950 transition-[border-color,transform] duration-150 ease-out hover:border-gray-400 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950"
            >
              Ahora no
            </button>
          </div>

          <p className="mt-2 text-[12px] leading-4 text-gray-500 sm:mt-3">
            El precio web vale solo comprando en la página.{" "}
            <Link href="/terminos#5-precios" onClick={() => cerrar(false)} className="-mx-1 inline-flex h-11 items-center px-1 underline underline-offset-2 hover:text-navy-950 sm:h-8">
              Condiciones
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
