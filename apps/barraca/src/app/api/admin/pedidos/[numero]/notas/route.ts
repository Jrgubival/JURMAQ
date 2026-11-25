import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, forbiddenResponse } from '@jurmaq/shared/auth/guard';
import { isValidOrigin } from '@jurmaq/shared/sanitize';
import { z, parseBody } from '@jurmaq/shared/validation';
import { rateLimit } from '@jurmaq/shared/rate-limit';
import { logSafe, logSafeError } from '@jurmaq/shared/logging';
import { pedidos, PATRON_NUMERO } from '@/lib/pedidos';
import { agregarNota, MAX_NOTA } from '@/lib/pedidos/notas';
import { usarGestion } from '@/lib/gestion';

/**
 * POST /api/admin/pedidos/[numero]/notas — agrega una nota interna al pedido
 * (D1 de gestión, la misma tabla que usa el MCP). Solo texto, hasta 500
 * caracteres; las notas no se editan ni se borran desde acá. Las ve solo el equipo.
 */
const schema = z.object({ texto: z.string().trim().min(1).max(MAX_NOTA) }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  if (!isValidOrigin(request)) return NextResponse.json({ error: 'Origen no autorizado' }, { status: 403 });
  const session = await requirePermission('barraca_ventas', 'update');
  if (!session) return forbiddenResponse();
  const usuarioId = session.user?.id ? String(session.user.id) : '';
  if (!usuarioId) return forbiddenResponse();

  const { numero } = await params;
  if (!PATRON_NUMERO.test(numero)) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });

  const rl = rateLimit(`nota-pedido:${usuarioId}`, { maxAttempts: 20, windowSeconds: 60 });
  if (!rl.success) return NextResponse.json({ error: 'Demasiadas notas seguidas. Espera un minuto.' }, { status: 429 });

  const parsed = parseBody(schema, await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: `Escribe una nota de hasta ${MAX_NOTA} caracteres.` }, { status: 400 });

  try {
    const pedido = await pedidos().porNumero(numero);
    if (!pedido) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    const r = await usarGestion((db) => agregarNota(db, numero, parsed.data.texto, { id: usuarioId, email: session.user?.email ?? null }));
    if (!r.ok) {
      return NextResponse.json(
        { error: r.motivo === 'tope' ? 'Este pedido ya tiene el máximo de notas.' : 'Escribe una nota con texto.' },
        { status: r.motivo === 'tope' ? 409 : 400 },
      );
    }
    logSafe('admin-pedido-nota', { numero, por: usuarioId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logSafeError('admin-pedido-nota-error', { numero, error: error instanceof Error ? error.name : 'error' });
    return NextResponse.json({ error: 'Las notas no están disponibles por ahora. Intenta más tarde.' }, { status: 503 });
  }
}
