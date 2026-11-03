/** Tipos y utilidades de la flota, sin dependencias de servidor. */

export const UNIDADES = ['hora', 'dia', 'semana', 'mes'] as const;
export type Unidad = (typeof UNIDADES)[number];

export const UNIDAD_LABEL: Record<Unidad, { uno: string; varios: string }> = {
  hora: { uno: 'hora', varios: 'horas' },
  dia: { uno: 'día', varios: 'días' },
  semana: { uno: 'semana', varios: 'semanas' },
  mes: { uno: 'mes', varios: 'meses' },
};

/** Valor referencial neto por período, editable desde el panel. */
export interface PrecioPeriodo {
  unidad: Unidad;
  valor: number;
  incluye: string;
}

export interface Maquina {
  id: number;
  nombre: string;
  tipo: string;
  descripcion: string;
  estado: string;
  fotos: string[];
  fotoReferencial: boolean;
  publicada: boolean;
  precios: PrecioPeriodo[];
  minimoUnidades: number | null;
}

export function esUnidad(v: unknown): v is Unidad {
  return typeof v === 'string' && (UNIDADES as readonly string[]).includes(v);
}

function leerPrecios(fila: Record<string, unknown>): PrecioPeriodo[] {
  // Lista vacía = "Cotizar". La columna sólo falta antes de la migración.
  if (Array.isArray(fila.precios)) {
    return fila.precios.flatMap((p: unknown) => {
      const o = (p ?? {}) as Record<string, unknown>;
      const valor = Number(o.valor);
      if (!esUnidad(o.unidad) || !Number.isFinite(valor) || valor <= 0) return [];
      return [{ unidad: o.unidad, valor: Math.round(valor), incluye: String(o.incluye ?? '') }];
    });
  }

  const tarifa = Number(fila.tarifa_neta);
  if (esUnidad(fila.unidad_tarifa) && Number.isFinite(tarifa) && tarifa > 0) {
    const minimo = Number(fila.minimo_unidades);
    const incluye =
      Number.isFinite(minimo) && minimo > 1
        ? `Mínimo ${minimo} ${UNIDAD_LABEL[fila.unidad_tarifa].varios}`
        : '';
    return [{ unidad: fila.unidad_tarifa, valor: Math.round(tarifa), incluye }];
  }
  return [];
}

/** La flota se cargó sin acentos; la migración lo corrige en la base. */
function conAcentos(t: string): string {
  return t
    .replace(/\bversatil\b/gi, 'versátil')
    .replace(/\bmultiples\b/gi, 'múltiples')
    .replace(/\bconstruccion\b/gi, 'construcción')
    .replace(/\belectric([oa])\b/gi, 'eléctric$1')
    .replace(/^Camion\b/, 'Camión');
}

export function leerMaquina(fila: Record<string, unknown>): Maquina {
  const imagenes = Array.isArray(fila.imagenes)
    ? fila.imagenes.filter((f): f is string => typeof f === 'string' && f.length > 0)
    : [];
  const imagen = typeof fila.imagen === 'string' && fila.imagen ? fila.imagen : null;
  const minimo = Number(fila.minimo_unidades);
  return {
    id: Number(fila.id),
    nombre: String(fila.nombre ?? '').replace(/^Camion\b/, 'Camión'),
    tipo: String(fila.tipo ?? ''),
    descripcion: conAcentos(String(fila.descripcion ?? '')),
    estado: String(fila.estado ?? ''),
    fotos: imagenes.length > 0 ? imagenes : imagen ? [imagen] : [],
    fotoReferencial: fila.foto_referencial !== false,
    publicada: fila.publicada !== false,
    precios: leerPrecios(fila),
    minimoUnidades: Number.isFinite(minimo) && minimo > 0 ? minimo : null,
  };
}

export function slugBase(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Misma forma que en jurmaq.cl: las rutas no cambian con el dominio. */
export function fichaHref(m: { id: number; nombre: string }): string {
  return `/maquinarias/${slugBase(m.nombre)}-${m.id}`;
}

export function idDesdeSlug(slug: string): number | null {
  const m = slug.match(/(?:^|-)(\d{1,9})$/);
  return m ? Number(m[1]) : null;
}

export function textoPrecio(p: PrecioPeriodo, formato: (n: number) => string): string {
  return `${formato(p.valor)} + IVA / ${UNIDAD_LABEL[p.unidad].uno}`;
}
