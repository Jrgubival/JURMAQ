import 'server-only';
import { z } from '@jurmaq/shared/validation';

/**
 * Campos editables de un producto desde el panel (POST /api/productos y
 * PUT /api/productos/[slug]). Whitelist + tipos: antes el handler copiaba
 * `body[campo]` tal cual, así que un precio "abc", negativo o NaN llegaba a la
 * base. Los números aceptan string numérico (inputs de formulario) pero se
 * validan con Number.isFinite; '' y null quedan como null.
 */
const numero = (min = 0, max = 1_000_000_000) =>
  z.preprocess(
    (v) => (v === '' || v === null ? null : typeof v === 'string' ? Number(v) : v),
    z.number().finite().min(min).max(max).nullable(),
  );

const idOpcional = z.preprocess(
  (v) => (v === '' || v === null ? null : typeof v === 'string' ? Number(v) : v),
  z.number().int().positive().nullable(),
);

const texto = (max: number) => z.string().trim().max(max).nullable();

export const camposProducto = z
  .object({
    codigo: texto(60),
    nombre: z.string().trim().min(1).max(250),
    slug: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/).max(200),
    descripcion: texto(10_000),
    precio: numero(0, 100_000_000),
    costo: numero(0, 100_000_000),
    // El stock puede venir con decimales (metros, kilos) desde la planilla.
    stock: numero(-1_000_000, 1_000_000),
    peso: numero(0, 100_000),
    unidad: texto(30),
    categoria_id: idOpcional,
    imagen: texto(2_000),
    producto_padre_id: idOpcional,
    medida: texto(120),
    activo: z.boolean(),
    destacado: z.boolean(),
  })
  .partial()
  .strip();

export type CamposProducto = z.infer<typeof camposProducto>;
