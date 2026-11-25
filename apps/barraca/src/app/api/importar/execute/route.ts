export const maxDuration = 60; // Allow up to 60 seconds for large imports

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { rateLimit, getClientIp } from '@jurmaq/shared/rate-limit';
import { parseExcelFile, matchProducts, executeImport } from '@/lib/import-barraca-smart';
import { leerConfigImportacion, MAX_FILAS_IMPORTACION } from '@/lib/import-barraca/config';

import { conRevalidacion } from '@/lib/revalidar';
async function manejarPOST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_importar', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  // Excel import can rewrite the whole catalog; cap aggressively.
  const ip = getClientIp(request);
  const limiter = rateLimit(`import-exec:${ip}`, { maxAttempts: 3, windowSeconds: 300 });
  if (!limiter.success) {
    return NextResponse.json({ error: 'Demasiadas importaciones. Espera 5 minutos.' }, { status: 429 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const config = leerConfigImportacion(formData.get('config'));
  if (!(file instanceof File) || !config) {
    return NextResponse.json({ error: 'Archivo y configuracion requeridos' }, { status: 400 });
  }

  let result;
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
    result = await executeImport(matches, {
      createNew: config.createNew,
      createPromotionalPrices: config.createPromotionalPrices,
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo importar. Intenta de nuevo.' }, { status: 500 });
  }

  return NextResponse.json(result);
}

// Si el cambio se guardó, las fichas y categorías en caché se invalidan.
export const POST = conRevalidacion(manejarPOST);
