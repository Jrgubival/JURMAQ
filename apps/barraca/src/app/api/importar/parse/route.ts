import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { parseExcelFile, detectColumnMapping } from '@/lib/import-barraca-smart';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  const session = await requirePermission('barraca_importar', 'create');
  if (!session) return forbiddenResponse('No tienes permiso');

  const formData = await request.formData();
  const file = formData.get('file') as File;
  if (!file) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseExcelFile(buffer);
  const columnMapping = detectColumnMapping(parsed.headers);

  return NextResponse.json({
    sheetNames: parsed.sheetNames,
    headers: parsed.headers,
    columnMapping,
    sampleRows: parsed.sampleRows,
    totalRows: parsed.totalRows,
  });
}
