import { supabaseAdmin } from "@jurmaq/shared/supabase";
import bcrypt from 'bcryptjs';

let initialized = false;

export async function initializeDatabase() {
  if (initialized) return;
  initialized = true;

  try {
    // Tables are already created in Supabase cloud.
    // This function only seeds initial data if tables are empty.

    // Seed admin user
    const hashedPassword = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'change-me-in-env', 12);
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', 'contacto@jurmaq.cl')
      .single();

    if (!existingUser) {
      await supabaseAdmin.from('users').insert({
        name: 'Jorge Ubilla',
        email: 'contacto@jurmaq.cl',
        password: hashedPassword,
        role: 'admin',
      });
    }

    // Seed ALL 9 real machines from jurmaq.cl/machinery
    const { count: machineCount } = await supabaseAdmin
      .from('maquinarias')
      .select('*', { count: 'exact', head: true });

    if ((machineCount || 0) === 0) {
      const machines = [
        {
          nombre: 'Retroexcavadora HMK 102B',
          tipo: 'retroexcavadora',
          descripcion: 'Retroexcavadora versatil para multiples aplicaciones en construccion. Combina las funciones de un cargador frontal y una excavadora trasera. Ideal para excavaciones, carga de material, nivelacion de terrenos y trabajos de demolicion ligera.',
          precio_dia: 200000, precio_semana: 1000000, precio_mes: 3500000,
          estado: 'disponible',
          imagen: '/images/maquinarias/retroexcavadora-hmk-102b.jpg',
        },
        {
          nombre: 'Miniexcavadora XCMG XE35U',
          tipo: 'miniexcavadora',
          descripcion: 'Miniexcavadora compacta ideal para trabajos en espacios reducidos. Ofrece alto rendimiento en excavaciones precisas, zanjas, nivelaciones y demolicion ligera, con gran eficiencia y maniobrabilidad.',
          precio_dia: 176000, precio_semana: 880000, precio_mes: 3000000,
          estado: 'disponible',
          imagen: '/images/maquinarias/miniexcavadora-xcmg-xe35u.jpg',
        },
        {
          nombre: 'Brazo Articulado JLG E450AJ',
          tipo: 'brazo_articulado',
          descripcion: 'Brazo articulado electrico, versatil y silencioso, ideal para trabajos en altura en interiores y exteriores. Altura maxima de trabajo de 15.72 metros con capacidad de carga de 230 kg.',
          precio_dia: 85000, precio_semana: 425000, precio_mes: 1450000,
          estado: 'disponible',
          imagen: '/images/maquinarias/brazo-articulado-jlg-e450aj.jpg',
        },
        {
          nombre: 'Plataforma Elevadora Fullen PSC140',
          tipo: 'alzahombre',
          descripcion: 'Plataforma elevadora tipo tijera electrica, ideal para trabajos en altura en espacios interiores y exteriores. Altura maxima de trabajo de 14 metros con plataforma extensible.',
          precio_dia: 65000, precio_semana: 325000, precio_mes: 1100000,
          estado: 'disponible',
          imagen: '/images/maquinarias/plataforma-fullen-psc140.jpg',
        },
        {
          nombre: 'Minicargador Bobcat S650',
          tipo: 'minicargador',
          descripcion: 'Minicargador compacto y maniobrable para trabajos en espacios reducidos. Versatilidad para multiples aplicaciones con diferentes implementos como martillo hidraulico, horquilla y balde.',
          precio_dia: 176000, precio_semana: 880000, precio_mes: 3000000,
          estado: 'disponible',
          imagen: '/images/maquinarias/minicargador-bobcat-s650.jpg',
        },
        {
          nombre: 'Camion Tolva VW Constellation 31.260E',
          tipo: 'camion',
          descripcion: 'Camion tolva ideal para el transporte de materiales como tierra y aridos en obras de construccion. Gran capacidad de carga y resistencia para trabajos pesados.',
          precio_dia: 200000, precio_semana: 1000000, precio_mes: 3600000,
          estado: 'disponible',
          imagen: '/images/maquinarias/camion-tolva-vw-constellation.jpg',
        },
        {
          nombre: 'Plataforma Elevadora Genie GS-1930',
          tipo: 'alzahombre',
          descripcion: 'Plataforma elevadora tipo tijera electrica compacta, ideal para trabajos en altura en espacios interiores y exteriores. Altura de trabajo de 7.79 metros, silenciosa y sin emisiones.',
          precio_dia: 45000, precio_semana: 225000, precio_mes: 700000,
          estado: 'disponible',
          imagen: '/images/maquinarias/plataforma-genie-gs1930.png',
        },
        {
          nombre: 'Plataforma Elevadora AloLift 80N',
          tipo: 'alzahombre',
          descripcion: 'Plataforma elevadora tipo tijera electrica, ideal para trabajos en altura en espacios interiores y exteriores. Diseno compacto con excelente maniobrabilidad.',
          precio_dia: 45000, precio_semana: 225000, precio_mes: 700000,
          estado: 'disponible',
          imagen: '/images/maquinarias/plataforma-alolift-80n.jpg',
        },
        {
          nombre: 'Minicargador Bobcat S570',
          tipo: 'minicargador',
          descripcion: 'Minicargador compacto y maniobrable para trabajos en espacios reducidos. Versatilidad para multiples aplicaciones con diferentes implementos. Motor de 68 HP con gran capacidad operativa.',
          precio_dia: 160000, precio_semana: 800000, precio_mes: 2800000,
          estado: 'disponible',
          imagen: '/images/maquinarias/minicargador-bobcat-s570.jpg',
        },
      ];

      await supabaseAdmin.from('maquinarias').insert(machines);
    }

    // Seed sample projects if empty
    const { count: projectCount } = await supabaseAdmin
      .from('proyectos')
      .select('*', { count: 'exact', head: true });

    if ((projectCount || 0) === 0) {
      await supabaseAdmin.from('proyectos').insert([
        { nombre: 'Fundaciones Silos - Nestle Teno', cliente: 'Nestle Chile', tipo: 'construccion', monto: 76000, estado: 'completado', descripcion: 'Fundaciones silos de granos, expansion batcheo y molienda, montaje equipos UMAS, pavimentos.' },
        { nombre: 'Bodega de Cubas - Miguel Torres', cliente: 'Vinicola Miguel Torres', tipo: 'construccion', monto: 21000, estado: 'completado', descripcion: 'Bodega de cubas (2a etapa), traslado de 14 cubas de 50.000 lts., porteria central.' },
        { nombre: 'Sala Electrica - Cementos Biobio', cliente: 'Cementos Biobio', tipo: 'construccion', monto: 5500, estado: 'en_progreso', descripcion: 'Sala electrica, muro contencion, cierres perimetrales, pavimentos.' },
        { nombre: 'Mantencion Iansagro', cliente: 'Iansagro S.A.', tipo: 'maestranza', monto: 6000, estado: 'en_progreso', descripcion: 'Mantencion permanente de estructuras, pavimentos, cubierta silos.' },
        { nombre: 'Montajes Surfrut', cliente: 'Surfrut Romeral', tipo: 'construccion', monto: 5000, estado: 'completado', descripcion: 'Ductos, camaras, piscinas de frutas, cambio cubierta galpon, montajes estructurales.' },
      ]);
    }

    // NOTE: barraca seed se hace ahora en apps/barraca/src/lib/init-db.ts.
    // Esta app constructora NO seeds tablas barraca_*.
  } catch (error) {
    // Silently handle errors during build
    console.warn('DB init warning:', error);
  }
}
