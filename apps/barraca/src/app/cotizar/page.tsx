import { permanentRedirect } from "next/navigation";

// El formulario de cotización se reemplazó por la tienda en línea (oct-2026).
// Quien llega por un enlace viejo o un marcador cae en su carrito.
export default function CotizarPage() {
  permanentRedirect("/carrito");
}
