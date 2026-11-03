import type { Metadata } from "next";
import CabezaPagina from "@/components/CabezaPagina";
import Cierre from "@/components/Cierre";
import Cifras from "@/components/Cifras";
import LogosClientes from "@/components/LogosClientes";
import { EMPRESA, url } from "@/data/empresa";

const TITULO = "Empresa constructora de Curicó";
const DESCRIPCION =
  "Constructora JURMAQ: base en Maquehua, Curicó, maestranza propia y obras en plantas de la Región del Maule y O'Higgins desde 2000.";

const EQUIPO = [
  ["Administradores de obra", "Planificación, control de costos y nexo directo con el cliente."],
  ["Supervisores de terreno", "Control de ejecución según planos y coordinación de cuadrillas."],
  ["Prevencionistas de riesgo", "Presencia en terreno, con la normativa chilena y los estándares del mandante."],
  ["Equipos técnicos", "Ingenieros, topógrafos, especialistas en maquinaria y operarios calificados."],
];

const PROCESO = [
  "Reunión técnica inicial",
  "Propuesta con ingeniería",
  "Planificación y horas hombre",
  "Ejecución supervisada",
  "Informes de avance",
  "Entrega",
];

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: url("/nosotros") },
  openGraph: { title: TITULO, description: DESCRIPCION, url: url("/nosotros") },
};

export default function Nosotros() {
  return (
    <>
      <CabezaPagina
        migas={[{ nombre: "Nosotros", ruta: "/nosotros" }]}
        titulo="Empresa constructora con base en Curicó"
        bajada="Obras industriales, civiles y metalmecánicas para el sector agroindustrial, alimenticio y productivo, en O'Higgins y el Maule."
        foto={{ nombre: "alero-lateral", alt: "Bodega industrial con equipos elevadores" }}
      />
      <section className="seccion">
        <div className="contenedor">
          <h2 className="sub">Para mandantes y licitaciones</h2>
          <dl className="roles">
            {EQUIPO.map(([rol, detalle]) => (
              <div key={rol}>
                <dt>{rol}</dt>
                <dd>{detalle}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="banda-logos">
        <div className="contenedor">
          <LogosClientes />
        </div>
      </section>
      <Cifras />
      <section className="seccion">
        <div className="contenedor ficha-grilla">
          <div>
            <h2 className="sub">Cómo trabajamos</h2>
            <ol className="proceso">
              {PROCESO.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </div>
          <dl className="ficha">
            <div>
              <dt>Razón social</dt>
              <dd>{EMPRESA.razonSocial}</dd>
            </div>
            <div>
              <dt>RUT</dt>
              <dd>{EMPRESA.rut}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{EMPRESA.direccion}</dd>
            </div>
            <div>
              <dt>Gerente</dt>
              <dd>Jorge Ubilla Rivera, Ingeniero Mecánico</dd>
            </div>
          </dl>
        </div>
      </section>
      <Cierre />
    </>
  );
}
