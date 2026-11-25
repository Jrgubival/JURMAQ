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
import { auditarSeoHerramienta, confirmarSeoHerramienta, editarSeoHerramienta, previsualizarSeoHerramienta, verSeoHerramienta } from "./seo.ts";
import { fijarRelacionadosHerramienta, quitarRelacionadosHerramienta, verRelacionadosHerramienta } from "./relacionados.ts";
import {
  confirmarPublicacionGuiaHerramienta, descartarBorradorGuiaHerramienta, guardarBorradorGuiaHerramienta, listarGuiasHerramienta,
  previsualizarPublicacionGuiaHerramienta, restaurarVersionGuiaHerramienta, verGuiaHerramienta,
} from "./guias-contenido.ts";
import { verMarcasHerramienta } from "./marcas.ts";
import { editarBorradorCorreo, listarPlantillasCorreo, previsualizarCorreo, publicarCorreo, restaurarCorreo, verPlantillaCorreo } from "./correos.ts";
import { borrarCampanaBorrador, guardarCampanaBorrador, restaurarCampanaVersion, verCampanas } from "./campanas.ts";

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
// Etapa 2, SEO editable, guías, relacionados y marcas (solo lectura).
registro.agregar(verSeoHerramienta);
registro.agregar(auditarSeoHerramienta);
registro.agregar(editarSeoHerramienta);
registro.agregar(previsualizarSeoHerramienta);
registro.agregar(confirmarSeoHerramienta);
registro.agregar(verRelacionadosHerramienta);
registro.agregar(fijarRelacionadosHerramienta);
registro.agregar(quitarRelacionadosHerramienta);
registro.agregar(listarGuiasHerramienta);
registro.agregar(verGuiaHerramienta);
registro.agregar(guardarBorradorGuiaHerramienta);
registro.agregar(descartarBorradorGuiaHerramienta);
registro.agregar(restaurarVersionGuiaHerramienta);
registro.agregar(previsualizarPublicacionGuiaHerramienta);
registro.agregar(confirmarPublicacionGuiaHerramienta);
registro.agregar(verMarcasHerramienta);
// Etapa 2: textos de correos al cliente (publicar siempre con OK de Jorge) y borradores de campañas (nunca envían).
registro.agregar(listarPlantillasCorreo);
registro.agregar(verPlantillaCorreo);
registro.agregar(editarBorradorCorreo);
registro.agregar(previsualizarCorreo);
registro.agregar(publicarCorreo);
registro.agregar(restaurarCorreo);
registro.agregar(verCampanas);
registro.agregar(guardarCampanaBorrador);
registro.agregar(restaurarCampanaVersion);
registro.agregar(borrarCampanaBorrador);
