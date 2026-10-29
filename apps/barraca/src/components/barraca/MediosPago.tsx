/**
 * Medios de pago como fila de logos (pie de página). SVG en línea y livianos:
 * nada de imágenes externas. El dueño eligió Webpay (oct-2026) en vez de
 * Mercado Pago; la transferencia es manual. El logo de Webpay Plus es el
 * oficial de transbankdevelopers.cl/brand-assets, limpiado de los datos de
 * Illustrator (400 KB → 33 KB) en public/images/barraca/pagos/.
 */

const chip = "inline-flex items-center justify-center h-8 px-2.5 bg-white rounded-md";

export default function MediosPago({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Medios de pago">
      <li className={chip} title="Webpay Plus">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/barraca/pagos/webpay-plus.svg" alt="Webpay Plus" width={81} height={20} className="h-5 w-auto" loading="lazy" />
      </li>
      <li className={chip} title="Visa">
        <svg viewBox="0 0 44 16" className="h-3.5 w-auto" role="img" aria-label="Visa">
          <text x="0" y="14" fontFamily="Arial, Helvetica, sans-serif" fontSize="16" fontWeight="900" fontStyle="italic" fill="#1A1F71" letterSpacing="0.5">VISA</text>
        </svg>
      </li>
      <li className={chip} title="Mastercard">
        <svg viewBox="0 0 32 20" className="h-5 w-auto" role="img" aria-label="Mastercard">
          <circle cx="11" cy="10" r="8" fill="#EB001B" />
          <circle cx="21" cy="10" r="8" fill="#F79E1B" />
          <path d="M16 3.76a8 8 0 0 1 0 12.48 8 8 0 0 1 0-12.48z" fill="#FF5F00" />
        </svg>
      </li>
      <li className={`${chip} gap-1.5 text-[12px] font-semibold text-navy-950`}>
        <svg className="w-4 h-4 text-navy-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={2} />
          <path d="M3 10h18" strokeWidth={2} />
        </svg>
        Débito
      </li>
      <li className={`${chip} gap-1.5 text-[12px] font-semibold text-navy-950`}>
        <svg className="w-4 h-4 text-navy-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18" />
        </svg>
        Transferencia
      </li>
    </ul>
  );
}
