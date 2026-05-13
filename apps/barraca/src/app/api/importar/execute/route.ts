export const maxDuration = 60; // Allow up to 60 seconds for large imports

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { parseExcelFile, matchProducts, executeImport } from '@/lib/import-barraca-smart';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_importar', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const configJson = formData.get('config') as string;

  if (!file || !configJson) return NextResponse.json({ error: 'Archivo y configuracion requeridos' }, { status: 400 });

  const config = JSON.parse(configJson);
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseExcelFile(buffer);

  const matches = await matchProducts(
    parsed.rows,
    config.columnMapping,
    config.matchBy || 'codigo',
    config.fieldsToUpdate || ['precio', 'stock', 'costo'],
    config.createPromotionalPrices || false,
  );

  // Filter: skip creates if not enabled
  const toProcess = matches.map(m => {
    if (m.status === 'create' && !config.createNew) {
      return { ...m, status: 'skip' as const };
    }
    return m;
  });

  const result = await executeImport(toProcess, {
    createNew: config.createNew || false,
    createPromotionalPrices: config.createPromotionalPrices || false,
  });

  return NextResponse.json(result);
}
