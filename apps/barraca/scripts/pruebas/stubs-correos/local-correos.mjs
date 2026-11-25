import { datosLocalRespaldo } from "../../../src/lib/contenido/local-respaldo.ts";
import { vistaLocal } from "../../../src/lib/contenido/derivados.ts";
import { textosLocal } from "../../../src/lib/pedidos/textos-local.ts";
export async function textosDelLocal() {
  return textosLocal(vistaLocal(datosLocalRespaldo()));
}
