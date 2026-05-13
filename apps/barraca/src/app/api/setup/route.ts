import { supabaseAdmin } from '@jurmaq/shared/supabase';
import { auth } from '@jurmaq/shared/auth';
import { NextRequest, NextResponse } from 'next/server';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

const PROMOTIONS = [
  { titulo: 'Fierros de Construccion -15%', descripcion: 'Descuento en toda la linea de fierros estriados, barras y varillas de construccion', descuento: 15, match: 'fierros' },
  { titulo: 'Mega Oferta en Fierros -10%', descripcion: 'Fierros estriados de 6mm a 25mm con precios rebajados por tiempo limitado', descuento: 10, match: 'fierros' },
  { titulo: 'Liquidacion de Fierros -20%', descripcion: 'Precios imbatibles en fierros para tu obra. Stock limitado', descuento: 20, match: 'fierros' },
  { titulo: 'Herramientas al mejor precio -20%', descripcion: 'Herramientas manuales y electricas con descuento especial', descuento: 20, match: 'herramienta' },
  { titulo: 'Festival de Herramientas -15%', descripcion: 'Todo en herramientas para tu taller y obra con precios rebajados', descuento: 15, match: 'herramienta' },
  { titulo: 'Pinturas en oferta -10%', descripcion: 'Pinturas, esmaltes y barnices con descuento. Todas las marcas', descuento: 10, match: 'pintura' },
  { titulo: 'Semana del Color -15%', descripcion: 'Aprovecha descuentos en toda nuestra linea de pinturas y accesorios', descuento: 15, match: 'pintura' },
  { titulo: 'Semana de la Electricidad -25%', descripcion: 'Cables, interruptores, luminarias y todo para tu instalacion electrica', descuento: 25, match: 'electricidad' },
  { titulo: 'Ofertas en Iluminacion -20%', descripcion: 'Ampolletas, focos LED y luminarias con precios especiales', descuento: 20, match: 'electricidad' },
  { titulo: 'Fijaciones con descuento -15%', descripcion: 'Pernos, tornillos, clavos y fijaciones de todo tipo', descuento: 15, match: 'fijacion' },
  { titulo: 'Todo en Fijaciones -10%', descripcion: 'Descuento especial en nuestra linea completa de fijaciones', descuento: 10, match: 'fijacion' },
  { titulo: 'Perfiles y Planchas -10%', descripcion: 'Angulos, canales, tubos y planchas metalicas a precios rebajados', descuento: 10, match: 'perfil' },
  { titulo: 'Oferta en Acero -15%', descripcion: 'Planchas, perfiles y tubos de acero con descuento directo', descuento: 15, match: 'perfil' },
  { titulo: 'Renueva tu Bano -20%', descripcion: 'Griferias, accesorios y productos para bano y cocina', descuento: 20, match: 'bano' },
  { titulo: 'Especial Cocina y Loggia -15%', descripcion: 'Descuentos en lavaplatos, griferias y accesorios de cocina', descuento: 15, match: 'bano' },
  { titulo: 'Seguridad Industrial -15%', descripcion: 'Elementos de proteccion personal y seguridad para tu obra', descuento: 15, match: 'seguridad' },
  { titulo: 'Proteccion al mejor precio -10%', descripcion: 'Cascos, guantes, lentes y ropa de trabajo con descuento', descuento: 10, match: 'seguridad' },
  { titulo: 'Especial Jardin -20%', descripcion: 'Herramientas, mangueras y accesorios de jardin', descuento: 20, match: 'jardin' },
  { titulo: 'Adhesivos y Sellantes -10%', descripcion: 'Siliconas, adhesivos y sellantes de las mejores marcas', descuento: 10, match: 'adhesivo' },
  { titulo: 'Oferta en Sellado -15%', descripcion: 'Todo para sellar y pegar con descuento especial', descuento: 15, match: 'adhesivo' },
  { titulo: 'Cerraduras en oferta -15%', descripcion: 'Cerraduras, candados y sistemas de seguridad', descuento: 15, match: 'cerradura' },
  { titulo: 'Quincalleria rebajada -10%', descripcion: 'Bisagras, manillas, tiradores y toda la quincalleria', descuento: 10, match: 'quincall' },
  { titulo: 'Cercos y Mallas -15%', descripcion: 'Mallas, cercos y alambre para tu propiedad', descuento: 15, match: 'cerco' },
  { titulo: 'Aridos y Morteros -5%', descripcion: 'Cemento, aridos, morteros y mezclas para construccion', descuento: 5, match: 'arido' },
  { titulo: 'Oferta Tabiqueria -10%', descripcion: 'Planchas de yeso, perfiles y accesorios para tabiqueria', descuento: 10, match: 'tabique' },
  { titulo: 'Techumbre al mejor precio -15%', descripcion: 'Planchas de zinc, canaletas y accesorios de techumbre', descuento: 15, match: 'techum' },
  { titulo: 'Impermeabilizantes -20%', descripcion: 'Aditivos, impermeabilizantes y productos quimicos para construccion', descuento: 20, match: 'aditivo' },
  { titulo: 'Aislacion termica -10%', descripcion: 'Lana mineral, poliestireno y materiales de aislacion', descuento: 10, match: 'aislac' },
  { titulo: 'Oferta Relampago -25%', descripcion: 'Precios increibles solo por hoy. No te lo pierdas', descuento: 25, match: null },
  { titulo: 'Especial Constructor -30%', descripcion: 'Descuento especial para profesionales de la construccion', descuento: 30, match: null },
];

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    // Admin-only: reseeds the promotions table.
    if ((session.user as { role?: string }).role !== 'admin') {
      return NextResponse.json({ error: 'Requiere rol admin' }, { status: 403 });
    }

    // Check if table exists by trying to query it
    const { error: checkError } = await supabaseAdmin
      .from('barraca_promociones')
      .select('id')
      .limit(1);

    if (checkError) {
      // Table doesn't exist - return SQL for manual creation
      return NextResponse.json({
        error: 'La tabla barraca_promociones no existe',
        sql: `CREATE TABLE IF NOT EXISTS barraca_promociones (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  descuento_porcentaje INTEGER NOT NULL DEFAULT 10,
  categoria_id INTEGER REFERENCES barraca_categorias(id),
  imagen TEXT,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio DATE,
  fecha_fin DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
        instrucciones: 'Ejecuta este SQL en el editor SQL de Supabase Dashboard, luego vuelve a llamar este endpoint.',
      }, { status: 409 });
    }

    // Get categories
    const { data: categorias } = await supabaseAdmin
      .from('barraca_categorias')
      .select('id, nombre, slug')
      .eq('activa', true)
      .is('padre_id', null)
      .order('nombre');

    if (!categorias || categorias.length === 0) {
      return NextResponse.json({ error: 'No hay categorias' }, { status: 400 });
    }

    // Clear existing and seed
    await supabaseAdmin.from('barraca_promociones').delete().neq('id', 0);

    const rows = PROMOTIONS.map((p, i) => {
      let catId: number;
      if (p.match) {
        const cat = categorias.find((c: any) =>
          c.nombre.toLowerCase().includes(p.match!) ||
          c.slug.toLowerCase().includes(p.match!)
        );
        catId = cat ? cat.id : categorias[i % categorias.length].id;
      } else {
        catId = categorias[i % categorias.length].id;
      }
      return {
        titulo: p.titulo,
        descripcion: p.descripcion,
        descuento_porcentaje: p.descuento,
        categoria_id: catId,
        activa: true,
      };
    });

    const { data: inserted, error: insError } = await supabaseAdmin
      .from('barraca_promociones')
      .insert(rows)
      .select('id, titulo, descuento_porcentaje');

    if (insError) throw insError;

    return NextResponse.json({
      ok: true,
      message: `${inserted?.length || 0} promociones creadas`,
      promociones: inserted,
    });
  } catch (error: any) {
    console.error('Error en setup:', error);
    return NextResponse.json(
      { error: 'Error en setup', detail: error?.message },
      { status: 500 }
    );
  }
}
