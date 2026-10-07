import {
  AbilityBuilder,
  createMongoAbility,
  type ForcedSubject,
  type MongoAbility,
} from '@casl/ability';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete';

/**
 * Add one entry per business entity. Every tenant-owned subject carries its
 * `tenantId` so ownership can be checked with `subject('Name', entity)`.
 */
export interface SubjectShapes {
  User: { id: string; tenantId?: string };
  Tenant: { id: string };
}

export type Subject = keyof SubjectShapes;

type AbilitySubject =
  | 'all'
  | {
      [K in Subject]: K | (SubjectShapes[K] & ForcedSubject<K>);
    }[Subject];

export type AppAbility = MongoAbility<[Action, AbilitySubject]>;

export const USER_ROLES = ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_MEMBER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserContext {
  id: string;
  role: UserRole;
  tenantId?: string | undefined;
}

export function defineAbilityFor(user: UserContext): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (user.role === 'PLATFORM_ADMIN') {
    can('manage', 'all');
    return build();
  }

  const tenantId = user.tenantId;
  if (tenantId === undefined) return build();

  can('read', 'Tenant', { id: tenantId });
  can('read', 'User', { tenantId });
  can('update', 'User', { id: user.id });

  if (user.role === 'TENANT_ADMIN') {
    can('update', 'Tenant', { id: tenantId });
    can(['create', 'update', 'delete'], 'User', { tenantId });
  }

  return build();
}

export function defineAnonymousAbility(): AppAbility {
  return new AbilityBuilder<AppAbility>(createMongoAbility).build();
}
