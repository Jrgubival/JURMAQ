import { MONTOS_POR_CLIENTE } from "@/data/obras";

/** Banda oscura: desde cuándo trabajamos y cuánto con cada cliente. */
export default function Cifras() {
  return (
    <section className="cifras">
      <div className="contenedor cifras-grilla">
        <div>
          <h2 className="cifras-ano">
            <span>Desde</span> 2000
          </h2>
          <p>Obras dentro de plantas agroindustriales, de alimentos y cementeras en el Maule y O&apos;Higgins.</p>
        </div>
        <div>
          <ul className="montos">
            {MONTOS_POR_CLIENTE.map((m) => (
              <li key={m.cliente}>
                <strong>{m.monto}</strong>
                <span>{m.cliente}</span>
              </li>
            ))}
          </ul>
          <p className="nota">Montos aproximados acumulados por cliente.</p>
        </div>
      </div>
    </section>
  );
}
