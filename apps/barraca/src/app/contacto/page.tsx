import type { Metadata } from 'next';
import Link from '@/components/barraca/Enlace';
import { leerContenido, leerLocal } from '@/lib/contenido/lectura';

/**
 * /contacto — quién vende y cómo ubicarnos. Google Merchant Center exige que
 * el vendedor sea identificable (razón social, dirección, teléfono, correo)
 * con los mismos datos que la cuenta: todo sale de la fuente única de datos
 * del local (lib/contenido, con respaldo en LEGAL_INFO / HQ).
 *
 * Se regenera cada 5 minutos (y al publicar contenido): lee D1 con respaldo.
 */
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const B = await leerLocal();
  return {
    title: 'Contacto · Barraca de Fierros JURMAQ, Molina',
    description: `${B.razonSocial} · ${B.direccionCorta}. WhatsApp y teléfono ${B.telefonoDisplay}, correo ${B.email}. ${B.h.semana}.`,
    alternates: { canonical: 'https://barraca.jurmaq.cl/contacto' },
  };
}

const fila = 'grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 py-3 border-b border-[#EAEAEA] last:border-0 text-[15px]';

export default async function ContactoPage() {
  const [B, textos] = await Promise.all([leerLocal(), leerContenido('contacto')]);
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <h1 className="text-3xl font-bold text-navy-950 mb-2">Contacto</h1>
      <p className="text-[#5A5A57] mb-8 whitespace-pre-line">{textos.intro}</p>

      <dl className="rounded-xl border border-[#EAEAEA] bg-white px-5">
        <div className={fila}><dt className="text-[#787774]">Empresa</dt><dd className="text-[#111111]">{B.razonSocial}</dd></div>
        <div className={fila}><dt className="text-[#787774]">RUT</dt><dd className="text-[#111111] tabular-nums">{B.rut}</dd></div>
        <div className={fila}><dt className="text-[#787774]">Dirección</dt><dd className="text-[#111111]">{B.calle}, {B.comuna}, {B.region}, Chile · <a href={B.mapaUrl} target="_blank" rel="noopener noreferrer" className="text-marca-600 font-medium underline underline-offset-2">Ver en el mapa</a></dd></div>
        <div className={fila}><dt className="text-[#787774]">WhatsApp y teléfono</dt><dd><a href={B.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-[#111111] underline underline-offset-2 tabular-nums">{B.telefonoDisplay}</a></dd></div>
        <div className={fila}><dt className="text-[#787774]">Correo</dt><dd><a href={`mailto:${B.email}`} className="text-[#111111] underline underline-offset-2">{B.email}</a></dd></div>
        <div className={fila}><dt className="text-[#787774]">Horario</dt><dd className="text-[#111111]">{B.h.semana}<br />{B.h.sabado} · {B.h.domingo}</dd></div>
      </dl>

      <p className="mt-8 text-[15px] text-[#5A5A57]">
        <span className="whitespace-pre-line">{textos.nota}</span>{' '}
        <Link href="/envios-y-devoluciones" className="text-navy-950 underline underline-offset-2">Envíos y devoluciones</Link> ·{' '}
        <Link href="/terminos" className="text-navy-950 underline underline-offset-2">Términos y condiciones</Link> ·{' '}
        <Link href="/privacidad" className="text-navy-950 underline underline-offset-2">Privacidad</Link>
      </p>
    </div>
  );
}
