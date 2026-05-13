import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { parseExcelFile, matchProducts } from '@/lib/import-barraca-smart';

export async function POST(request: NextRequest) {
  const session = await requirePermission('barraca_importar', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const configJson = formData.get('config') as string;

  if (!file || !configJson) return NextResponse.json({ error: 'Archivo y configuracion requeridos' }, { status: 400 });

  const config = JSON.parse(configJson);
  // config: { columnMapping, matchBy, fieldsToUpdate, createNew, createPromotionalPrices }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseExcelFile(buffer);

  const matches = await matchProducts(
    parsed.rows,
    config.columnMapping,
    config.matchBy || 'codigo',
    config.fieldsToUpdate || ['precio', 'stock', 'costo'],
    config.createPromotionalPrices || false,
  );

  // Filter out create matches if createNew is false
  const filteredMatches = matches.map(m => {
    if (m.status === 'create' && !config.createNew) {
      return { ...m, status: 'skip' as const };
    }
    return m;
  });

  const summary = {
    toUpdate: filteredMatches.filter(m => m.status === 'update').length,
    toCreate: filteredMatches.filter(m => m.status === 'create').length,
    toSkip: filteredMatches.filter(m => m.status === 'skip').length,
    totalChanges: filteredMatches.reduce((sum, m) => sum + m.changes.length, 0),
  };

  // Return first 100 detailed matches + summary (for performance)
  return NextResponse.json({
    matches: filteredMatches.slice(0, 100),
    allMatchCount: filteredMatches.length,
    summary,
  });
}
