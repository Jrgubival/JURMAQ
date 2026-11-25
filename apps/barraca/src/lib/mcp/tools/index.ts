/**
 * Catálogo de herramientas del MCP. Para agregar una: crea tu archivo en esta
 * carpeta (usa `defineHerramienta` de ./registro.ts), impórtalo aquí y agrégalo
 * a `registro.agregar(...)`. No hay que tocar el servidor ni el OAuth.
 */
import { crearRegistro } from "./registro.ts";
import { guia } from "./guia.ts";
import { crearHerramientasContenido } from "./contenido.ts";
import { crearHerramientasImagenes } from "./imagenes.ts";
import { crearHerramientasCupones } from "./cupones.ts";
import { crearHerramientasOpiniones } from "./opiniones.ts";
import { crearHerramientasHistorial } from "./historial.ts";
import { herramientasPedidos } from "./pedidos.ts";
import { herramientasReportes } from "./reportes.ts";

export const registro = crearRegistro();
registro.agregar(guia);
// Contenido editable, imágenes, cupones, opiniones, historial y deshacer.
registro.agregar(...crearHerramientasContenido());
registro.agregar(...crearHerramientasImagenes());
registro.agregar(...crearHerramientasCupones());
registro.agregar(...crearHerramientasOpiniones());
registro.agregar(...crearHerramientasHistorial(() => registro));
// Pedidos (lectura, estado operativo, notas) y reportes de solo lectura.
registro.agregar(...herramientasPedidos);
registro.agregar(...herramientasReportes);
