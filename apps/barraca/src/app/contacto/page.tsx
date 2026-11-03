import type { Metadata } from 'next';
import Link from '@/components/barraca/Enlace';
import { LEGAL_INFO, HORARIO_BARRACA, HQ } from '@jurmaq/shared/seo';

/**
 * /contacto — quién vende y cómo ubicarnos. Google Merchant Center exige que
 * el vendedor sea identificable (razón social, dirección, teléfono, correo)
 * con los mismos datos que la cuenta: todo sale de LEGAL_INFO / HQ.
 */
const B = LEGAL_INFO.brands.barraca;
const MAPA = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${B.streetAddress}, ${B.addressLocality}, Chile`)}`;

export const metadata: Metadata = {
  title: 'Contacto · Barraca de Fierros JURMAQ, Molina',
  description: `${B.razonSocial} · Av. Poniente 2157, Molina. WhatsApp y teléfono ${B.telefonoDisplay}, correo ${HQ.email}. ${HORARIO_BARRACA.semana}.`,
  alternates: { canonical: 'https://barraca.jurmaq.cl/contacto' },
};

const fila = 'grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 py-3 border-b border-[#EAEAEA] last:border-0 text-[15px]';

export default function ContactoPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="text-3xl font-bold text-navy-950 mb-2">Contacto</h1>
      <p className="text-[#5A5A57] mb-8">Atendemos en el local de Molina, por WhatsApp, por teléfono y por correo.</p>

      <dl className="rounded-xl border border-[#EAEAEA] bg-white px-5">
        <div className={fila}><dt className="text-[#787774]">Empresa</dt><dd className="text-[#111111]">{B.razonSocial}</dd></div>
        <div className={fila}><dt className="text-[#787774]">RUT</dt><dd className="text-[#111111] tabular-nums">{B.rut}</dd></div>
        <div className={fila}><dt className="text-[#787774]">Dirección</dt><dd className="text-[#111111]">{B.streetAddress}, {B.addressLocality}, {B.addressRegion}, Chile · <a href={MAPA} target="_blank" rel="noopener noreferrer" className="text-marca-600 font-medium underline underline-offset-2">Ver en el mapa</a></dd></div>
        <div className={fila}><dt className="text-[#787774]">WhatsApp y teléfono</dt><dd><a href={B.whatsapp} target="_blank" rel="noopener noreferrer" className="text-[#111111] underline underline-offset-2 tabular-nums">{B.telefonoDisplay}</a></dd></div>
        <div className={fila}><dt className="text-[#787774]">Correo</dt><dd><a href={`mailto:${HQ.email}`} className="text-[#111111] underline underline-offset-2">{HQ.email}</a></dd></div>
        <div className={fila}><dt className="text-[#787774]">Horario</dt><dd className="text-[#111111]">{HORARIO_BARRACA.semana}<br />{HORARIO_BARRACA.sabado} · {HORARIO_BARRACA.domingo}</dd></div>
      </dl>

      <p className="mt-8 text-[15px] text-[#5A5A57]">
        Para un pedido ya hecho, ten a mano el número (BJ-…) que te llegó por correo.{' '}
        <Link href="/envios-y-devoluciones" className="text-navy-950 underline underline-offset-2">Envíos y devoluciones</Link> ·{' '}
        <Link href="/terminos" className="text-navy-950 underline underline-offset-2">Términos y condiciones</Link> ·{' '}
        <Link href="/privacidad" className="text-navy-950 underline underline-offset-2">Privacidad</Link>
      </p>
    </div>
  );
}
