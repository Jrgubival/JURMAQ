import Link from "next/link";
import Flecha from "@/components/Flecha";
import Foto from "@/components/Foto";
import type { FotoObra } from "@/data/obras";

export interface ItemTarjeta {
  href: string;
  titulo: string;
  /** Dato secundario: cliente y ubicación, o una línea de resumen. */
  meta?: string;
  /** Descripción breve bajo el título. */
  texto?: string;
  cta: string;
  foto?: FotoObra;
  /** Si no hay foto: logo real del cliente sobre un plano. */
  logo?: { src: string; nombre: string; w: number; h: number };
}

/**
 * Filas completas, sin celdas sueltas: 4 = 2+2, 5 = 2+3, 7 = 3+4.
 * La fila más corta va primero y sus tarjetas, más anchas, hacen de foco.
 */
function filas(n: number): number[] {
  if (n <= 3) return [n];
  const k = Math.ceil(n / 3);
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i >= k - extra ? 1 : 0));
}

export default function Tarjetas({ items, titulo = "h3" }: { items: ItemTarjeta[]; titulo?: "h2" | "h3" }) {
  const anchos = filas(items.length).flatMap((f) => Array<number>(f).fill(12 / Math.max(f, 2)));
  const Titulo = titulo;
  return (
    <ul className="tarjetas">
      {items.map((t, i) => (
        <li key={t.href} className="tarjeta" style={{ "--span": anchos[i] } as React.CSSProperties}>
          <div className={t.foto ? "tarjeta-foto" : "tarjeta-foto tarjeta-plano"}>
            {t.foto ? (
              <Foto foto={t.foto} sizes={`(max-width: 640px) 100vw, (max-width: 1024px) 50vw, ${Math.round((anchos[i] / 12) * 100)}vw`} />
            ) : (
              t.logo && <img src={t.logo.src} alt={t.logo.nombre} width={t.logo.w} height={t.logo.h} loading="lazy" decoding="async" />
            )}
          </div>
          <div className="tarjeta-cuerpo">
            {t.meta && <p className="tarjeta-meta">{t.meta}</p>}
            <Titulo className="tarjeta-titulo">
              <Link href={t.href}>{t.titulo}</Link>
            </Titulo>
            {t.texto && <p className="tarjeta-texto">{t.texto}</p>}
            <span className="tarjeta-cta" aria-hidden="true">
              {t.cta} <Flecha />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
