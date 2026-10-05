"use client";

import { trackCustom } from "@/lib/analytics";
import { mensajeDescuentoProducto, urlWhatsapp } from "@/lib/whatsapp-descuento";

/**
 * Botón rojo "Pide tu precio con descuento": abre WhatsApp con el producto y
 * su código ya escritos. Va bajo el precio en cada tarjeta y en la ficha.
 *
 * En celular es la acción principal de la tarjeta: alto mínimo de 48 px y
 * ancho completo, con el texto en dos líneas si la tarjeta es angosta, en vez
 * de achicar la letra.
 *
 * En escritorio la tarjeta mide distinto según la grilla (5 columnas en la
 * portada, 3 en categorías). El botón mira el ancho de la tarjeta, no el de la
 * pantalla (container query: la tarjeta declara `@container`): si es angosta
 * (5 columnas en escritorio, 2 en celular) deja el ícono para que el texto
 * quepa en una línea en escritorio y en dos —no tres— en celular.
 */
export default function BotonDescuento({
  nombre,
  codigo,
  cantidad,
  lugar,
  grande = false,
  className = "",
}: {
  nombre: string;
  codigo?: string | null;
  /** Sólo en la ficha, donde el cliente ya eligió la cantidad. */
  cantidad?: number;
  /** Dónde está el botón, para medirlo en Analytics ("tarjeta", "ficha"). */
  lugar: string;
  /** Ficha de producto: botón principal de la página, más alto y con letra mayor. */
  grande?: boolean;
  className?: string;
}) {
  const tamano = grande
    ? "min-h-[56px] px-4 py-3 text-base rounded-xl shadow-lg"
    : "min-h-[48px] lg:min-h-[44px] px-2 @min-[230px]:px-3 py-2.5 text-[13px] lg:text-[12.5px] @min-[230px]:text-sm rounded-lg shadow-sm";
  return (
    <a
      href={urlWhatsapp(mensajeDescuentoProducto(nombre, codigo, cantidad))}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackCustom("whatsapp_descuento", { lugar, codigo: codigo ?? "", nombre })}
      aria-label={`Pide tu precio con descuento para ${nombre} por WhatsApp`}
      className={`w-full flex items-center justify-center gap-2 ${tamano} font-bold leading-tight text-center text-white bg-marca-600 hover:bg-marca-700 shadow-marca-200 transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] touch-manipulation ${className}`}
    >
      <svg className={`${grande ? "w-5 h-5" : "w-4 h-4 hidden @min-[230px]:block"} shrink-0`} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      <span>Pide tu precio con descuento</span>
    </a>
  );
}
