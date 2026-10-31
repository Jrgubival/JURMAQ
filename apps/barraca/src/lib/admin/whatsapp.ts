/**
 * Link de WhatsApp para coordinar un pedido con el cliente desde el panel.
 * Sin dependencias de servidor (lo usa la página de pedidos).
 */

/**
 * Teléfono chileno a formato internacional sin "+" (lo que pide wa.me):
 *   "+56 9 1234 5678" / "912345678" / "12345678" / "0056912345678" → "56912345678".
 * Devuelve null si no parece un número usable.
 */
export function telefonoChileWa(telefono: string | null | undefined): string | null {
  let d = String(telefono ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('56')) {
    return d.length === 11 ? d : null;
  }
  d = d.replace(/^0+/, '');
  if (d.length === 9) return `56${d}`; // 9 1234 5678 (celular) o 2 2123 4567 (fijo Santiago)
  if (d.length === 8) return `569${d}`; // celular antiguo sin el 9
  return null;
}

export function linkWhatsappPedido(p: { telefono: string; nombre: string; numero: string }): string | null {
  const tel = telefonoChileWa(p.telefono);
  if (!tel) return null;
  const nombre = p.nombre.trim().split(/\s+/)[0] || '';
  const texto = `Hola${nombre ? ` ${nombre}` : ''}, te escribimos de Barraca JURMAQ por tu pedido ${p.numero}.`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}
