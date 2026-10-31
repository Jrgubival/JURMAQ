import type { Metadata } from "next";
import Link from "@/components/barraca/Enlace";
import { logSafeError } from "@jurmaq/shared/logging";
import { pedidos, PATRON_NUMERO, type Pedido } from "@/lib/pedidos";
import { opinarValido } from "@/lib/pedidos/enlace";
import { autorPublico, productosOpinados } from "@/lib/opiniones";
import FormOpinion from "./FormOpinion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu opinión | Barraca JURMAQ",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Página del enlace "Dar mi opinión" del correo post-entrega. El token es un
 * HMAC del número de pedido (lib/pedidos/enlace.ts): no hace falta cuenta.
 * Muestra los productos del pedido y deja opinar una vez por producto.
 */
function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-[#111111] mb-3">{titulo}</h1>
      <p className="text-[#5A5A57] mb-8">{texto}</p>
      <Link href="/categorias" className="inline-flex items-center px-6 py-3 bg-navy-950 text-white text-sm font-medium rounded-lg">
        Ir al catálogo
      </Link>
    </div>
  );
}

export default async function OpinarPage({ params }: { params: Promise<{ numero: string; token: string }> }) {
  const { numero, token } = await params;

  let pedido: Pedido | null = null;
  let opinados = new Set<number>();
  if (PATRON_NUMERO.test(numero) && opinarValido(numero, token)) {
    try {
      pedido = await pedidos().porNumero(numero);
      if (pedido) opinados = await productosOpinados(numero);
    } catch (error) {
      logSafeError("opinar-pagina", { numero, error: String(error) });
      return <Aviso titulo="No pudimos abrir tu pedido" texto="Intenta de nuevo en unos minutos." />;
    }
  }

  if (!pedido) {
    return <Aviso titulo="Enlace no válido" texto="Revisa que copiaste el enlace completo del correo. Si el problema sigue, escríbenos a contacto@jurmaq.cl." />;
  }
  if (pedido.estado !== "entregado") {
    return <Aviso titulo="Todavía no puedes opinar" texto="Podrás calificar los productos cuando el pedido esté entregado." />;
  }

  // Un producto puede venir en más de una línea; se opina una vez.
  const productos = [...new Map(pedido.items.map((i) => [Number(i.productoId), i.nombre])).entries()].map(([id, nombre]) => ({
    id,
    nombre,
    yaOpinado: opinados.has(id),
  }));

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 lg:py-12">
      <p className="text-[10px] font-semibold text-[#787774] uppercase tracking-[0.22em] mb-2">
        Pedido <span className="tabular-nums">{pedido.numero}</span>
      </p>
      <h1 className="text-[#111111] leading-[1.15] mb-3" style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 500 }}>
        ¿Qué te parecieron tus productos?
      </h1>
      <p className="text-[15px] text-[#5A5A57] mb-6">
        Califica cada producto de 1 a 5 estrellas. El comentario es opcional. Tu opinión se publica con el nombre{" "}
        <strong className="text-[#111111]">{autorPublico(pedido.nombre)}</strong> y puedes dejar una por producto.
      </p>
      <div className="space-y-4">
        {productos.map((p) => (
          <FormOpinion key={p.id} numero={pedido.numero} token={token} productoId={p.id} nombre={p.nombre} yaOpinado={p.yaOpinado} />
        ))}
      </div>
    </div>
  );
}
