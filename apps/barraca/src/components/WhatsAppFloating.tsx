"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Floating WhatsApp button for mobile-first conversion.
 *
 * Mounted via dynamic() en (public)/layout.tsx y barraca/layout.tsx con
 * ssr:false. AST/graphify no captura dynamic imports, por eso aparece
 * como satélite aunque está activo en producción en ambos shells.
 *
 * - Fixed bottom-right, thumb-reachable.
 * - 56x56 (above the 44 minimum, generous for one-handed use).
 * - Hides on /admin and on the contract signature flow to avoid covering CTAs.
 * - Auto-hides while scrolling DOWN, reappears on scroll UP — keeps content
 *   readable while still being one tap away.
 * - Adds aria-label and `data-magnetic` so it plays nicely with the rest of
 *   the design system.
 */
export default function WhatsAppFloating() {
  const pathname = usePathname() || "/";
  const [visible, setVisible] = useState(true);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      // Always show near the top of the page
      if (y < 80) {
        setVisible(true);
      } else if (y > lastY + 16) {
        setVisible(false); // scrolling down → hide
      } else if (y < lastY - 16) {
        setVisible(true); // scrolling up → show
      }
      setLastY(y);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lastY]);

  // Hide on admin and contract signing pages
  if (pathname.startsWith("/admin") || pathname.startsWith("/contrato/firmar")) {
    return null;
  }

  // Different default message depending on which site/section
  const message = pathname.startsWith("/barraca") || pathname.startsWith("/categorias") || pathname.startsWith("/producto") || pathname === "/carrito" || pathname.startsWith("/cuenta")
    ? "Hola, vengo de la barraca y quiero cotizar"
    : pathname.startsWith("/maquinarias")
    ? "Hola, quiero cotizar arriendo de maquinaria"
    : "Hola, quiero hacer una consulta";

  const href = `https://wa.me/56976673577?text=${encodeURIComponent(message)}`;

  function handleClick() {
    import("@/lib/analytics")
      .then(({ trackEvents }) => trackEvents.whatsappClick(pathname || "/"))
      .catch(() => { /* analytics no debe romper UX */ });
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label="Escríbenos por WhatsApp"
      className={`fixed bottom-20 lg:bottom-5 right-5 z-40 w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-[#25D366] text-white shadow-lg shadow-green-900/30 flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-[#1ebe5d] touch-manipulation ${
        visible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
      </svg>
    </a>
  );
}
