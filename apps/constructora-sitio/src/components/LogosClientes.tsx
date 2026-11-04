/** Clientes que figuran en los documentos de la empresa. Logos autorizados por Jorge. */
export const LOGOS = [
  { src: "/clientes/nestle.webp", nombre: "Nestlé", w: 387, h: 400, alto: 76 },
  { src: "/clientes/miguel-torres.png", nombre: "Miguel Torres", w: 1080, h: 1080, alto: 118 },
  { src: "/clientes/cbb-cementos.png", nombre: "Cementos Biobío", w: 306, h: 198, alto: 64 },
  { src: "/clientes/iansa.webp", nombre: "Iansagro", w: 500, h: 500, alto: 104 },
  { src: "/clientes/surfrut.svg", nombre: "Surfrut", w: 236, h: 65, alto: 40 },
  { src: "/clientes/valdivieso.png", nombre: "Viña Valdivieso", w: 1080, h: 1080, alto: 128 },
];

/** Logo del cliente de una obra, si está autorizado. */
export function logoDe(mandante: string) {
  return LOGOS.find((l) => mandante.includes(l.nombre));
}

export default function LogosClientes() {
  return (
    <ul className="logos" aria-label="Clientes">
      {LOGOS.map((l) => (
        <li key={l.src}>
          <img
            src={l.src}
            alt={l.nombre}
            width={l.w}
            height={l.h}
            style={{ height: l.alto, width: "auto" }}
            loading="lazy"
            decoding="async"
          />
        </li>
      ))}
    </ul>
  );
}
