/**
 * Catálogo de roles del panel admin.
 *
 * Cada rol declara qué módulos puede ver y qué acciones puede ejecutar.
 * Mantenemos el modelo simple (no granular por endpoint) — los chequeos
 * se hacen por módulo + acción ('read'|'create'|'update'|'delete').
 *
 * Convención de strings:
 *   - role.modules → qué tabs aparecen en el sidebar
 *   - role.can(module, action) → permite o no la acción
 *   - 'admin' es wildcard: siempre true.
 */

export type RoleId = 'admin' | 'gerente' | 'vendedor' | 'operador' | 'contador';

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  /** Cambiar SOLO el estado (no datos/precio). Operador y dueños. */
  | 'update_estado'
  /** Anular contrato (transición especial separada de delete). */
  | 'anular'
  /** Editar plantilla del contrato — solo admin/gerente. */
  | 'manage_templates'
  /** Validar / marcar recuperada una factura de combustible. */
  | 'validate'
  /** Exportar reportes (Excel SII, etc.). */
  | 'export';

/**
 * Módulos del admin Constructora — operaciones, catálogo, tributario,
 * configuración. NO incluye barraca_* (esos viven en BarracaModule).
 */
export type ConstructoraModule =
  | 'dashboard'
  | 'maquinarias'
  | 'solicitudes'
  | 'cotizaciones'
  | 'proyectos'
  | 'clientes'
  | 'contratos'
  | 'combustible'
  | 'usuarios';

/**
 * Módulos del admin Barraca — todos prefijados con `barraca_*` por
 * convención. Mantenemos `dashboard` también acá porque cada panel tiene
 * su propia home, aunque el módulo conceptual sea el mismo.
 */
export type BarracaModule =
  | 'dashboard'
  | 'barraca_productos'
  | 'barraca_categorias'
  | 'barraca_cotizaciones'
  | 'barraca_promociones'
  | 'barraca_imagenes'
  | 'barraca_precios'
  | 'barraca_importar'
  | 'barraca_suscriptores';

/**
 * Union de ambos. `Module` queda como type-alias para no romper los ~30
 * call sites que ya importan `Module`. La intención del split es que
 * código nuevo prefiera `ConstructoraModule` o `BarracaModule` según
 * scope, pero `Module` sigue válido (subset = ambos).
 */
export type Module = ConstructoraModule | BarracaModule;

interface RoleDef {
  label: string;
  description: string;
  /** Qué módulos ve este rol en el sidebar (read garantizado en todos). */
  modules: Module[];
  /** Acciones específicas permitidas/denegadas. Si no se lista una acción
   *  para un módulo, se asume `read` (si el módulo está en `modules`). */
  permissions: Partial<Record<Module, Action[]>>;
  /** Color/badge CSS para identificarlo en la UI. */
  badgeClass: string;
}

const ALL_BARRACA_MODULES: Module[] = [
  'barraca_productos',
  'barraca_categorias',
  'barraca_cotizaciones',
  'barraca_promociones',
  'barraca_imagenes',
  'barraca_precios',
  'barraca_importar',
  'barraca_suscriptores',
];

const ALL_MODULES: Module[] = [
  'dashboard',
  'maquinarias',
  'solicitudes',
  'cotizaciones',
  'proyectos',
  'clientes',
  'contratos',
  'combustible',
  'usuarios',
  ...ALL_BARRACA_MODULES,
];

// Helper para definir todas las acciones a la vez.
const ALL_ACTIONS: Action[] = ['read', 'create', 'update', 'delete', 'update_estado', 'anular', 'manage_templates', 'validate', 'export'];

export const ROLES: Record<RoleId, RoleDef> = {
  admin: {
    label: 'Administrador',
    description: 'Acceso completo. Único que crea y elimina otros usuarios.',
    modules: ALL_MODULES,
    permissions: {}, // wildcard handled by `can()` for admin
    badgeClass: 'bg-red-100 text-red-700',
  },
  gerente: {
    label: 'Gerente',
    description: 'Acceso completo excepto gestión de usuarios.',
    modules: ALL_MODULES.filter((m) => m !== 'usuarios'),
    permissions: {
      dashboard: ['read'],
      maquinarias: ALL_ACTIONS,
      solicitudes: ALL_ACTIONS,
      cotizaciones: ALL_ACTIONS,
      proyectos: ALL_ACTIONS,
      clientes: ALL_ACTIONS,
      contratos: ALL_ACTIONS,
      combustible: ALL_ACTIONS,
      barraca_productos: ALL_ACTIONS,
      barraca_categorias: ALL_ACTIONS,
      barraca_cotizaciones: ALL_ACTIONS,
      barraca_promociones: ALL_ACTIONS,
      barraca_imagenes: ALL_ACTIONS,
      barraca_precios: ALL_ACTIONS,
      barraca_importar: ALL_ACTIONS,
      barraca_suscriptores: ALL_ACTIONS,
    },
    badgeClass: 'bg-purple-100 text-purple-700',
  },
  vendedor: {
    label: 'Vendedor / Comercial',
    description: 'Cotiza, atiende solicitudes, prepara contratos. NO precios ni combustible.',
    modules: [
      'dashboard',
      'maquinarias',
      'solicitudes',
      'cotizaciones',
      'clientes',
      'contratos',
      'barraca_cotizaciones',
    ],
    permissions: {
      dashboard: ['read'],
      // Solo lectura de la flota — precios y datos los maneja gerencia.
      maquinarias: ['read'],
      // Atención de clientes
      solicitudes: ['read', 'create', 'update'],
      cotizaciones: ['read', 'create', 'update'],
      clientes: ['read', 'create', 'update'],
      // Contratos: crea, edita en borrador, envía a firma, marca vigente,
      // anula y borra borradores. NO puede editar plantilla.
      contratos: ['read', 'create', 'update', 'update_estado', 'anular', 'delete'],
      // Cotizaciones de la barraca también las atiende (mensajes, contraofertas).
      barraca_cotizaciones: ['read', 'create', 'update'],
    },
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  operador: {
    label: 'Operador / Despacho',
    description: 'Cambia estado de máquinas y contratos vigentes. Registra carga de combustible.',
    modules: ['dashboard', 'maquinarias', 'contratos', 'combustible'],
    permissions: {
      dashboard: ['read'],
      // Operador SOLO cambia estado (disponible/arrendada/mantención).
      // El handler PUT debe whitelistar el campo `estado` para este rol.
      maquinarias: ['read', 'update_estado'],
      // Marca contratos como vigentes/vencidos al recibir/devolver máquina.
      contratos: ['read', 'update_estado'],
      // Carga combustible al despachar — no valida ni elimina.
      combustible: ['read', 'create'],
    },
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  contador: {
    label: 'Contador / Finanzas',
    description: 'Combustible end-to-end (F29 SII). Ve cotizaciones para conciliar pagos.',
    modules: ['dashboard', 'cotizaciones', 'combustible', 'barraca_cotizaciones'],
    permissions: {
      dashboard: ['read'],
      // Solo lectura de cotizaciones — para reconciliar.
      cotizaciones: ['read'],
      barraca_cotizaciones: ['read'],
      // Combustible: control completo para tributario.
      combustible: ['read', 'create', 'update', 'delete', 'validate', 'export'],
    },
    badgeClass: 'bg-green-100 text-green-700',
  },
};

export const ROLE_OPTIONS = (Object.entries(ROLES) as Array<[RoleId, RoleDef]>).map(
  ([id, def]) => ({ id, label: def.label, description: def.description })
);

/** Devuelve true si el rol puede ejecutar la acción sobre el módulo. */
export function can(role: string | undefined | null, module: Module, action: Action): boolean {
  if (!role) return false;
  if (role === 'admin') return true;
  const def = ROLES[role as RoleId];
  if (!def) return false;
  if (!def.modules.includes(module)) return false;
  const allowed = def.permissions[module];
  if (!allowed) return action === 'read';
  if (allowed.includes(action)) return true;

  // Subsumption: a role with `update` (full edit) implicitly has `update_estado`
  // (subset). Same logic for `delete` implying `anular`. This keeps the
  // matrix in roles.ts terse while letting handlers be specific about what
  // narrow action they need.
  if (action === 'update_estado' && allowed.includes('update')) return true;
  if (action === 'anular' && (allowed.includes('update') || allowed.includes('delete'))) return true;

  return false;
}

/** Devuelve los módulos visibles en el sidebar para este rol. */
export function visibleModules(role: string | undefined | null): Module[] {
  if (!role) return [];
  if (role === 'admin') return ALL_MODULES;
  const def = ROLES[role as RoleId];
  return def ? def.modules : [];
}

/** Validador para POST/PUT — asegura que el rol enviado existe. */
export function isValidRole(value: unknown): value is RoleId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROLES, value);
}
