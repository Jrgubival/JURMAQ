import { NextResponse } from 'next/server';
import { z } from '@jurmaq/shared/validation';
import { esGestionNoDisponible } from '../gestion/tipos.ts';

/** Esquemas y respuestas compartidos por las rutas del panel de cupones. */

export const reglasSchema = z
  .object({
    categoriasModo: z.enum(['todas', 'incluir', 'excluir']),
    categoriasIds: z.array(z.number().int().positive()).max(100),
    unUsoPorCliente: z.boolean(),
    noAcumulable: z.boolean(),
  })
  .strict();

const fecha = z.union([z.string().trim().max(40), z.null()]);

export const crearSchema = z
  .object({
    codigo: z.string().trim().min(3).max(30),
    descripcion: z.union([z.string().max(300), z.null()]).optional(),
    tipo: z.enum(['porcentaje', 'monto_fijo']),
    valor: z.number().positive().max(1_000_000_000),
    montoMinimoCompra: z.number().int().min(0).max(1_000_000_000).optional(),
    maxUsosTotal: z.union([z.number().int().positive().max(10_000_000), z.null()]).optional(),
    maxUsosPorUsuario: z.number().int().min(0).max(1000).optional(),
    validoDesde: fecha.optional(),
    validoHasta: fecha.optional(),
    activo: z.boolean().optional(),
    reglas: reglasSchema.optional(),
  })
  .strict();

export const editarSchema = crearSchema.omit({ codigo: true }).partial().strict();

export function respuestaGestionNoDisponible() {
  return NextResponse.json({ error: 'La base de gestión no está disponible por ahora. Intenta más tarde.' }, { status: 503 });
}

export function esNoDisponible(e: unknown): boolean {
  return esGestionNoDisponible(e);
}
