/**
 * Catálogo de herramientas del MCP. Para agregar una: crea tu archivo en esta
 * carpeta (usa `defineHerramienta` de ./registro.ts), impórtalo aquí y agrégalo
 * a `registro.agregar(...)`. No hay que tocar el servidor ni el OAuth.
 */
import { crearRegistro } from "./registro.ts";
import { guia } from "./guia.ts";

export const registro = crearRegistro();
registro.agregar(guia);
