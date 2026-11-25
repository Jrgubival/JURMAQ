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
import { buscarProductos, crearCategoria, crearProducto, editarCategoria, editarProducto, listarCategorias, verMargenes, verProducto } from "./productos.ts";
import { confirmarPrecios, previsualizarPrecios } from "./precios.ts";
import { cambiarDespacho, verZonasDespacho } from "./despacho.ts";
import { herramientasDescuentoTransferencia } from "./descuento-transferencia.ts";
import { cancelarOferta, programarOferta, verOfertas } from "./ofertas.ts";

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
// Productos, categorías, precios masivos (dos pasos), despacho y ofertas con fecha.
registro.agregar(buscarProductos);
registro.agregar(verProducto);
registro.agregar(listarCategorias);
registro.agregar(verMargenes);
registro.agregar(editarProducto);
registro.agregar(crearProducto);
registro.agregar(crearCategoria);
registro.agregar(editarCategoria);
registro.agregar(previsualizarPrecios);
registro.agregar(confirmarPrecios);
registro.agregar(verZonasDespacho);
registro.agregar(cambiarDespacho);
registro.agregar(programarOferta);
registro.agregar(verOfertas);
registro.agregar(cancelarOferta);
// Descuento por transferencia configurable (ver, previsualizar, confirmar con aprobación).
registro.agregar(...herramientasDescuentoTransferencia);
