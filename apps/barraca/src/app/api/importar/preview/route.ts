import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { parseExcelFile, matchProducts, resumirImportacion, type MatchResult } from '@/lib/import-barraca-smart';
import { leerConfigImportacion, MAX_FILAS_IMPORTACION } from '@/lib/import-barraca/config';

const MAX_POR_ESTADO = 100;

/** Versión liviana de una fila para la pantalla (sin la fila completa del Excel ni todas las fichas). */
function aliviar(m: MatchResult) {
  return {
    rowIndex: m.rowIndex,
    fila: m.rowIndex + 2,
    status: m.status,
    via: m.via,
    motivo: m.motivo ?? null,
    alertas: m.alertas,
    bajoCosto: !!m.bajoCosto,
    margenBajo: !!m.margenBajo,
    fichas: m.matchedProducts.length,
    codigo: m.matchedProduct?.codigo ?? m.excelRow?.Codigo ?? m.excelRow?.codigo ?? null,
    nombre: m.matchedProduct?.nombre ?? m.excelRow?.Nombre ?? m.excelRow?.nombre ?? null,
    changes: m.changes,
  };
}

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_importar', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const formData = await request.formData();
  const file = formData.get('file');
  const config = leerConfigImportacion(formData.get('config'));
  if (!(file instanceof File) || !config) {
    return NextResponse.json({ error: 'Archivo y configuracion requeridos' }, { status: 400 });
  }

  try {
    const parsed = parseExcelFile(Buffer.from(await file.arrayBuffer()));
    if (parsed.totalRows > MAX_FILAS_IMPORTACION) {
      return NextResponse.json({ error: 'El archivo tiene demasiadas filas. Divídelo en partes.' }, { status: 400 });
    }
    const matches = await matchProducts(
      parsed.rows,
      config.columnMapping,
      config.matchBy,
      config.fieldsToUpdate,
      config.createPromotionalPrices,
      { createNew: config.createNew },
    );
    const summary = resumirImportacion(matches);

    // La vista previa nunca esconde filas: muestra hasta 100 de CADA estado.
    const cuenta: Record<string, number> = {};
    const muestra: ReturnType<typeof aliviar>[] = [];
    for (const m of matches) {
      cuenta[m.status] = (cuenta[m.status] ?? 0) + 1;
      if (cuenta[m.status] <= MAX_POR_ESTADO) muestra.push(aliviar(m));
    }
    return NextResponse.json({ matches: muestra, allMatchCount: matches.length, summary });
  } catch {
    return NextResponse.json({ error: 'No se pudo generar la vista previa. Intenta de nuevo.' }, { status: 500 });
  }
}
