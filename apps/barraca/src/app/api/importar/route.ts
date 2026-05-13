import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { isValidOrigin } from '@jurmaq/shared/sanitize';

export async function POST(request: NextRequest) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  }
  try {
    const session = await requirePermission('barraca_importar', 'create');
    if (!session) return forbiddenResponse('No tienes permiso');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Se requiere un archivo XLSX' }, { status: 400 });
    }

    // Save temporary file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tmpPath = path.join(os.tmpdir(), `barraca-import-${Date.now()}.xlsx`);
    await writeFile(tmpPath, buffer);

    // Import using utility function
    const { importBarracaFromXLSX } = await import('@/lib/import-barraca-smart');
    const result = await importBarracaFromXLSX(tmpPath);

    return NextResponse.json({
      mensaje: 'Importacion completada',
      categorias: result.categories,
      productos: result.products,
    });
  } catch (error) {
    console.error('Error al importar:', error);
    return NextResponse.json(
      { error: 'Error al importar archivo' },
      { status: 500 }
    );
  }
}
