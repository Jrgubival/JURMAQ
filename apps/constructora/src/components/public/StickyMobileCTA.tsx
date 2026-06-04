"use client";

import Link from "next/link";
import WhatsappLink from "@/components/public/WhatsappLink";
import { whatsappCtaMaquinaria } from "@jurmaq/shared/whatsapp";

/**
 * StickyMobileCTA — Barra fija inferior SOLO en móvil (`lg:hidden`) con los dos
 * caminos de conversión de una ficha de máquina: cotizar online (wizard) y
 * WhatsApp (1 click). En móvil el CTA principal queda fuera del viewport al
 * hacer scroll por la descripción/specs; esta barra lo mantiene siempre visible.
 *
 * Objetivo del plan SEO/CRO: subir las solicitudes de arriendo. El tráfico es
 * mayoritariamente móvil y este es el punto de fricción más alto.
 */
export default function StickyMobileCTA({
  maquinariaId,
  maquinariaNombre,
}: {
  maquinariaId: number;
  maquinariaNombre: string;
}) {
  return (
    <div
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] flex gap-2 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
      role="region"
      aria-label="Acciones de arriendo"
    >
      <Link
        href={`/cotizar-arriendo?maquinariaId=${maquinariaId}`}
        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-sm rounded-xl transition-colors tactile"
      >
        Cotizar online
      </Link>
      <WhatsappLink
        href={whatsappCtaMaquinaria(maquinariaId, maquinariaNombre)}
        source="sticky_mobile_maquinaria"
        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl transition-colors tactile"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
        </svg>
        WhatsApp
      </WhatsappLink>
    </div>
  );
}
