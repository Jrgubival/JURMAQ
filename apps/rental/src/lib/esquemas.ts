import { z } from '@jurmaq/shared/validation';
import { TIPOS_LINEA, UNIDADES_LINEA } from './cotizacion';
import { UNIDADES } from './maquinas';
import { ESTADOS_COTIZACION, ESTADOS_MAQUINA, TIPOS_PANEL } from './opciones';

const fotoUrl = z.string().max(500).regex(/^(\/images\/|https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/)/);

export const MaquinaEsquema = z.object({
  nombre: z.string().trim().min(2).max(120),
  tipo: z.enum(TIPOS_PANEL.map((t) => t.valor) as [string, ...string[]]),
  descripcion: z.string().trim().max(1000),
  estado: z.enum(ESTADOS_MAQUINA.map((e) => e.valor) as [string, ...string[]]),
  publicada: z.boolean(),
  fotoReferencial: z.boolean(),
  fotos: z.array(fotoUrl).max(8),
  precios: z.array(z.object({
    unidad: z.enum(UNIDADES),
    valor: z.number().int().positive().max(999_999_999),
    incluye: z.string().trim().max(160),
  }).strict()).max(4),
}).strict();

const texto = (max: number) => z.string().trim().max(max).nullable().optional();

const LineaEsquema = z.object({
  tipo: z.enum(TIPOS_LINEA),
  maquinaria_id: z.number().int().positive().nullable().optional(),
  descripcion: z.string().trim().min(1).max(300),
  detalle: texto(300),
  cantidad: z.number().positive().max(999),
  unidad: z.enum(UNIDADES_LINEA),
  precio_unitario: z.number().int().min(0).max(999_999_999),
}).strict();

export const CotizacionEsquema = z.object({
  cliente_nombre: z.string().trim().min(2).max(160),
  cliente_rut: texto(20),
  cliente_contacto: texto(160),
  contacto_email: z.string().trim().email().max(254).nullable().optional().or(z.literal('')),
  cliente_telefono: texto(30),
  cliente_direccion: texto(200),
  servicio_detalle: texto(200),
  entrega_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable().optional().or(z.literal('')),
  retiro_fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  destino_nombre: texto(160),
  ubicacion_servicio: texto(250),
  validez_dias: z.number().int().min(1).max(365),
  descuento_neto: z.number().int().min(0).max(999_999_999),
  notas_cliente: texto(1000),
  solicitud_id: z.number().int().positive().nullable().optional(),
  lineas: z.array(LineaEsquema).min(1).max(30),
}).strict();

export type CotizacionEntrada = z.infer<typeof CotizacionEsquema>;

export const EstadoEsquema = z.object({ estado: z.enum(ESTADOS_COTIZACION) }).strict();
