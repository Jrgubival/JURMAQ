import 'server-only';
import type { z } from '@jurmaq/shared/validation';
import type { MaquinaEsquema } from './esquemas';

/** Lista cerrada de columnas: nada del cuerpo llega directo a la base. */
export function camposMaquina(d: z.infer<typeof MaquinaEsquema>) {
  // Contratos y admin de jurmaq.cl siguen leyendo la tarifa por hora o día.
  const tarifa = d.precios.find((p) => p.unidad === 'hora' || p.unidad === 'dia');
  return {
    nombre: d.nombre,
    tipo: d.tipo,
    descripcion: d.descripcion || null,
    estado: d.estado,
    publicada: d.publicada,
    foto_referencial: d.fotoReferencial,
    imagenes: d.fotos,
    imagen: d.fotos[0] ?? null,
    precios: d.precios,
    ...(tarifa ? { tarifa_neta: tarifa.valor, unidad_tarifa: tarifa.unidad } : {}),
  };
}
