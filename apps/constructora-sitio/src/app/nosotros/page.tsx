import type { Metadata } from "next";
import Cierre from "@/components/Cierre";
import Migas from "@/components/Migas";
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
      <div className="contenedor cabeza-pagina">
        <Migas items={[{ nombre: "Nosotros", ruta: "/nosotros" }]} />
        <h1>Empresa constructora con base en Curicó</h1>
        <p className="bajada">
          {EMPRESA.nombre} ({EMPRESA.razonSocial}) desarrolla obras industriales, civiles y metalmecánicas para el
          sector agroindustrial, alimenticio y productivo, con base en Curicó y cobertura en las regiones de O&apos;Higgins
          y del Maule.
        </p>
      </div>
      <section className="seccion" style={{ paddingTop: 0 }}>
        <div className="contenedor dos-columnas">
          <div>
            <h2 style={{ marginBottom: 14 }}>Para mandantes y licitaciones</h2>
            <dl className="ficha">
              {EQUIPO.map(([rol, detalle]) => (
                <div key={rol}>
                  <dt>{rol}</dt>
                  <dd>{detalle}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h2 style={{ marginBottom: 14 }}>Cómo trabajamos</h2>
            <ol className="lista" style={{ margin: 0, paddingLeft: 0, listStylePosition: "inside" }}>
              {PROCESO.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className="seccion">
        <div className="contenedor dos-columnas">
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
          <div />
        </div>
      </section>
      <Cierre />
    </>
  );
}
