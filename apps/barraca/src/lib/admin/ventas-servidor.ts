import 'server-only';
import { pedidos, type Pedido } from '@/lib/pedidos';
import {
  resolverPeriodo, limitesPeriodo, leerFiltros, calzaMedio, calzaZona, calzaBusqueda, calzaEstado,
  ordenarVentas, calcularTotales, contarAtender, GRUPOS_ESTADO, inicioDiaChile, sumarDias, diaChile,
  type Periodo, type Filtros, type Totales, type ConteoAtender, type GrupoEstado,
} from './ventas';

/**
 * Consulta del panel de Ventas, compartida por la lista (/api/admin/ventas)
 * y el Excel (/api/admin/ventas/export). Los filtros se leen con listas
 * cerradas (nada del usuario va a la consulta de la base salvo fechas ya
 * validadas); la búsqueda se hace en memoria.
 */

/** Tope de pedidos por período: la tienda es chica; si se llega, la pantalla lo avisa. */
export const LIMITE_PERIODO = 3000;

export type FilaVenta = Omit<Pedido, 'acceso_hash' | 'eventos' | 'courier_paquete' | 'comprobante_path' | 'documento_path'> & {
  tiene_comprobante: boolean;
  tiene_documento: boolean;
};

/**
 * Lo que puede ir al navegador: sin el hash de acceso ni las rutas de los
 * archivos privados (el panel los pide por su API, con permiso).
 */
export function aFila(p: Pedido): FilaVenta {
  const { acceso_hash: _h, eventos: _e, courier_paquete: _c, comprobante_path, documento_path, ...resto } = p;
  return { ...resto, tiene_comprobante: !!comprobante_path, tiene_documento: !!documento_path };
}

export interface ResultadoVentas {
  periodo: Periodo;
  filtros: Filtros;
  pedidos: Pedido[];
  totales: Totales;
  conteos: Record<GrupoEstado, number>;
  /** Pendientes de los últimos 90 días, aunque estén fuera del período. */
  atender: ConteoAtender;
  truncado: boolean;
}

export async function consultarVentas(sp: URLSearchParams): Promise<ResultadoVentas> {
  const periodo = resolverPeriodo(sp.get('periodo'), sp.get('desde'), sp.get('hasta'));
  const filtros = leerFiltros(sp);
  const lim = limitesPeriodo(periodo);
  const store = pedidos();

  const desde90 = inicioDiaChile(sumarDias(diaChile(new Date()), -89));
  const [enPeriodo, recientes] = await Promise.all([
    store.listarRango({ desde: lim.desde, hasta: lim.hasta, limite: LIMITE_PERIODO }),
    store.listarRango({ desde: desde90, hasta: new Date(Date.now() + 60_000).toISOString(), limite: LIMITE_PERIODO }),
  ]);

  // Medio, entrega y búsqueda mandan en los totales; el estado sólo en la lista
  // (si no, "Por pagar" mostraría $0 vendido).
  const base = enPeriodo.filter((p) => calzaMedio(p, filtros.medio) && calzaZona(p, filtros.zona) && calzaBusqueda(p, filtros.q));
  const conteos = Object.fromEntries(
    GRUPOS_ESTADO.map((g) => [g.id, base.filter((p) => calzaEstado(p, g.id)).length]),
  ) as Record<GrupoEstado, number>;

  return {
    periodo,
    filtros,
    pedidos: ordenarVentas(base.filter((p) => calzaEstado(p, filtros.estado))),
    totales: calcularTotales(base),
    conteos,
    atender: contarAtender(recientes),
    truncado: enPeriodo.length >= LIMITE_PERIODO,
  };
}
