/**
 * The permission catalog: every (action, subject) pair the system knows about.
 *
 * Code is the source of truth. `migrate.ts` syncs this list into the
 * `permissions` table (idempotent), so roles can reference permissions by id
 * with foreign-key integrity while a new entity still ships in the same PR that
 * adds its catalog entries.
 */
export const ACTIONS = ['manage', 'create', 'read', 'update', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

/** How far a granted permission reaches. Tenants can never grant 'any'. */
export const SCOPE_PRESETS = ['any', 'own_tenant', 'own_record'] as const;
export type ScopePreset = (typeof SCOPE_PRESETS)[number];

export const ROLE_SCOPES = ['platform', 'tenant'] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];

export interface CatalogEntry {
  action: Action;
  /** A key of SubjectShapes, or 'all'. */
  subject: string;
  description: string;
  /** Only roles of scope 'platform' may hold it. */
  platformOnly: boolean;
  /** Presets a tenant role may use for this entry. Empty when platformOnly. */
  presets: readonly ScopePreset[];
}

const entry = (
  action: Action,
  subject: string,
  description: string,
  presets: readonly ScopePreset[],
  platformOnly = false,
): CatalogEntry => ({ action, subject, description, platformOnly, presets });

export const PERMISSION_CATALOG: readonly CatalogEntry[] = [
  entry('manage', 'all', 'Full access to everything, across tenants', [], true),

  entry('read', 'User', 'View users', ['own_tenant', 'own_record']),
  entry('create', 'User', 'Create users', ['own_tenant']),
  entry('update', 'User', 'Edit users', ['own_tenant', 'own_record']),
  entry('delete', 'User', 'Delete or deactivate users', ['own_tenant']),

  entry('read', 'Tenant', 'View the tenant', ['own_tenant']),
  entry('create', 'Tenant', 'Create tenants', [], true),
  entry('update', 'Tenant', 'Edit the tenant', ['own_tenant']),
  entry('delete', 'Tenant', 'Delete tenants', [], true),

  entry('read', 'Role', 'View roles', ['own_tenant']),
  entry('create', 'Role', 'Create roles', ['own_tenant']),
  entry('update', 'Role', 'Edit roles and their permissions, assign roles', ['own_tenant']),
  entry('delete', 'Role', 'Delete roles', ['own_tenant']),
];

export const permissionKey = (action: string, subject: string): string => `${action}:${subject}`;

const CATALOG_BY_KEY = new Map(
  PERMISSION_CATALOG.map((item) => [permissionKey(item.action, item.subject), item]),
);

export function findCatalogEntry(action: string, subject: string): CatalogEntry | undefined {
  return CATALOG_BY_KEY.get(permissionKey(action, subject));
}

export interface PermissionGrant {
  action: Action;
  subject: string;
  preset: ScopePreset;
}

export interface SystemRoleDefinition {
  /** Fixed so the migration backfill and the sync agree on identity. */
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
  grants: readonly PermissionGrant[];
}

export const SYSTEM_ROLES = {
  PLATFORM_ADMIN: {
    id: '00000000-0000-4000-8000-000000000001',
    key: 'PLATFORM_ADMIN',
    name: 'Platform administrator',
    scope: 'platform',
    grants: [{ action: 'manage', subject: 'all', preset: 'any' }],
  },
  TENANT_ADMIN: {
    id: '00000000-0000-4000-8000-000000000002',
    key: 'TENANT_ADMIN',
    name: 'Tenant administrator',
    scope: 'tenant',
    grants: [
      { action: 'read', subject: 'User', preset: 'own_tenant' },
      { action: 'create', subject: 'User', preset: 'own_tenant' },
      { action: 'update', subject: 'User', preset: 'own_tenant' },
      { action: 'delete', subject: 'User', preset: 'own_tenant' },
      { action: 'read', subject: 'Tenant', preset: 'own_tenant' },
      { action: 'update', subject: 'Tenant', preset: 'own_tenant' },
      { action: 'read', subject: 'Role', preset: 'own_tenant' },
      { action: 'create', subject: 'Role', preset: 'own_tenant' },
      { action: 'update', subject: 'Role', preset: 'own_tenant' },
      { action: 'delete', subject: 'Role', preset: 'own_tenant' },
    ],
  },
  TENANT_MEMBER: {
    id: '00000000-0000-4000-8000-000000000003',
    key: 'TENANT_MEMBER',
    name: 'Tenant member',
    scope: 'tenant',
    grants: [
      { action: 'read', subject: 'User', preset: 'own_tenant' },
      { action: 'update', subject: 'User', preset: 'own_record' },
      { action: 'read', subject: 'Tenant', preset: 'own_tenant' },
    ],
  },
} as const satisfies Record<string, SystemRoleDefinition>;

export type SystemRoleKey = keyof typeof SYSTEM_ROLES;
export const SYSTEM_ROLE_LIST: readonly SystemRoleDefinition[] = Object.values(SYSTEM_ROLES);
export const SYSTEM_ROLE_IDS: ReadonlySet<string> = new Set(SYSTEM_ROLE_LIST.map((r) => r.id));

const PRESET_RANK: Record<ScopePreset, number> = { any: 3, own_tenant: 2, own_record: 1 };

/**
 * True when `holder` already has everything `wanted` would give: the same
 * (action, subject) at an equal or wider reach, or `manage:all`. This is the
 * anti-escalation rule: nobody can hand out more than they hold.
 */
export function grantsCover(holder: readonly PermissionGrant[], wanted: PermissionGrant): boolean {
  return holder.some((have) => {
    if (have.action === 'manage' && have.subject === 'all') return true;
    const sameAction = have.action === wanted.action || have.action === 'manage';
    return (
      sameAction &&
      have.subject === wanted.subject &&
      PRESET_RANK[have.preset] >= PRESET_RANK[wanted.preset]
    );
  });
}
