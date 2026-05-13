import { auth } from './index';
import type { RoleId, Module, Action } from '../roles';
import { can } from '../roles';

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return session;
}

export function unauthorizedResponse() {
  return Response.json({ error: 'No autorizado' }, { status: 401 });
}

export function forbiddenResponse(message = 'No tienes permiso para esta acción') {
  return Response.json({ error: message }, { status: 403 });
}

/**
 * Require an authenticated user whose role is in the allowed list.
 * Returns the session if allowed, or null if missing/forbidden.
 *
 * Usage in API routes:
 *   const session = await requireRole(['admin','gerente']);
 *   if (!session) return forbiddenResponse();
 */
export async function requireRole(allowed: RoleId[]) {
  const session = await auth();
  if (!session?.user) return null;
  const role = (session.user as { role?: string }).role;
  if (!role) return null;
  if (role === 'admin') return session; // admin bypasses
  if (allowed.includes(role as RoleId)) return session;
  return null;
}

/**
 * Require permission for a specific (module, action). Returns the session
 * if allowed, or null otherwise. Centralises the auth+role check so route
 * handlers stay clean.
 */
export async function requirePermission(module: Module, action: Action) {
  const session = await auth();
  if (!session?.user) return null;
  const role = (session.user as { role?: string }).role;
  if (!can(role, module, action)) return null;
  return session;
}
