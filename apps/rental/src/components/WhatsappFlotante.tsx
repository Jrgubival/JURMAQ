import { WhatsappLogo } from '@phosphor-icons/react/dist/ssr';
import { enlaceWhatsapp } from '@/lib/sitio';

/** Botón flotante de WhatsApp, igual al de barraca.jurmaq.cl.
 *  En celular se oculta si la página ya tiene la barra fija de Cotizar y WhatsApp. */
export default function WhatsappFlotante() {
  return (
    <a
      href={enlaceWhatsapp('Hola, quiero cotizar arriendo de maquinaria')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="wa-flotante fixed bottom-6 left-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-[#25D366] shadow-[0_4px_14px_-6px_rgba(8,20,40,0.35)] transition-colors hover:border-gray-300 mb-[env(safe-area-inset-bottom)]"
    >
      <WhatsappLogo size={20} weight="fill" aria-hidden />
    </a>
  );
}
