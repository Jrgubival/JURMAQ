import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@jurmaq/shared/auth/guard';

// Each entry returns a Postgres COUNT — head:true means we only fetch the count,
// not rows. Running them via Promise.all parallelizes 9 round-trips into 1
// network slot; previously the dashboard waited ~10× longer than necessary on
// cold connections.
const countQuery = (table: string) =>
  supabaseAdmin.from(table).select('*', { count: 'exact', head: true });

export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) return unauthorizedResponse();

    const [
      totalMaquinarias,
      maquinariasDisponibles,
      maquinariasArrendadas,
      maquinariasMantencion,
      totalSolicitudes,
      solicitudesPendientes,
      totalProyectos,
      proyectosActivos,
      totalCotizaciones,
      cotizacionesPendientes,
    ] = await Promise.all([
      countQuery('maquinarias'),
      countQuery('maquinarias').eq('estado', 'disponible'),
      countQuery('maquinarias').eq('estado', 'arrendada'),
      countQuery('maquinarias').eq('estado', 'mantencion'),
      countQuery('solicitudes'),
      countQuery('solicitudes').eq('estado', 'pendiente'),
      countQuery('proyectos'),
      countQuery('proyectos').eq('estado', 'en_progreso'),
      countQuery('cotizaciones'),
      countQuery('cotizaciones').eq('estado', 'pendiente'),
    ]);

    return NextResponse.json({
      maquinarias: {
        total: totalMaquinarias.count ?? 0,
        disponibles: maquinariasDisponibles.count ?? 0,
        arrendadas: maquinariasArrendadas.count ?? 0,
        mantencion: maquinariasMantencion.count ?? 0,
      },
      solicitudes: {
        total: totalSolicitudes.count ?? 0,
        pendientes: solicitudesPendientes.count ?? 0,
      },
      proyectos: {
        total: totalProyectos.count ?? 0,
        activos: proyectosActivos.count ?? 0,
      },
      cotizaciones: {
        total: totalCotizaciones.count ?? 0,
        pendientes: cotizacionesPendientes.count ?? 0,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadisticas' },
      { status: 500 }
    );
  }
}
