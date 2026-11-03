/** Clientes que figuran en los documentos de la empresa. Logos autorizados por Jorge. */
const LOGOS = [
  { src: "/clientes/nestle.webp", nombre: "Nestlé", w: 387, h: 400, alto: 52 },
  { src: "/clientes/miguel-torres.png", nombre: "Miguel Torres", w: 1080, h: 1080, alto: 84 },
  { src: "/clientes/cbb-cementos.png", nombre: "Cementos Biobío", w: 306, h: 198, alto: 44 },
  { src: "/clientes/iansa.webp", nombre: "Iansa", w: 500, h: 500, alto: 72 },
  { src: "/clientes/surfrut.svg", nombre: "Surfrut", w: 236, h: 65, alto: 28 },
  { src: "/clientes/valdivieso.png", nombre: "Viña Valdivieso", w: 1080, h: 1080, alto: 88 },
];

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
