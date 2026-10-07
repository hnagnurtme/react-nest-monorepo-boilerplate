import {
  AbilityBuilder,
  createMongoAbility,
  type ForcedSubject,
  type MongoAbility,
  type RawRuleOf,
} from '@casl/ability';
import { packRules, unpackRules, type PackRule } from '@casl/ability/extra';

import type { Action, PermissionGrant, ScopePreset } from './catalog.js';

/**
 * Add one entry per business entity. Tenant-owned subjects carry `tenantId` so
 * ownership can be checked with `subject('Name', entity)`.
 */
export interface SubjectShapes {
  User: { id: string; tenantId?: string | null };
  Tenant: { id: string };
  Role: { id: string; tenantId?: string | null; isSystem?: boolean };
}

export type Subject = keyof SubjectShapes;

type AbilitySubject =
  | 'all'
  | {
      [K in Subject]: K | (SubjectShapes[K] & ForcedSubject<K>);
    }[Subject];

export type AppAbility = MongoAbility<[Action, AbilitySubject]>;
export type AppRule = RawRuleOf<AppAbility>;
export type PackedRules = PackRule<AppRule>[];

/** Who the grants are being evaluated for. */
export interface UserContext {
  id: string;
  tenantId?: string | undefined;
}

type Conditions = Record<string, unknown>;

/**
 * Turns a stored preset into a CASL condition for one (action, subject).
 *
 * The preset is a closed vocabulary on purpose: tenants pick how far a
 * permission reaches but never author a query, so a role cannot be crafted to
 * match rows outside its tenant. Returns `null` when the combination is
 * meaningless, and the grant is then dropped (fail closed).
 */
export function conditionsFor(
  grant: PermissionGrant,
  user: UserContext,
): Conditions | undefined | null {
  if (grant.preset === 'any') return undefined;
  if (user.tenantId === undefined) return null;

  const { subject, preset } = grant;

  if (preset === 'own_record') {
    return subject === 'User' ? { id: user.id } : null;
  }

  // own_tenant
  switch (subject) {
    case 'User':
      return { tenantId: user.tenantId };
    case 'Tenant':
      return { id: user.tenantId };
    case 'Role':
      // Reading includes the shared system roles (tenantId null); writing never does.
      return grant.action === 'read'
        ? { tenantId: { $in: [user.tenantId, null] } }
        : { tenantId: user.tenantId };
    default:
      return null;
  }
}

/** Pure: same grants + same user => same ability, on the API and in the browser. */
export function buildAbility(grants: readonly PermissionGrant[], user: UserContext): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  for (const grant of grants) {
    const conditions = conditionsFor(grant, user);
    if (conditions === null) continue;
    // `can(action, subject, conditions?)` is typed per subject; the grant comes
    // from a validated catalog, so the loose call is safe here.
    const grantSubject = grant.subject as Subject | 'all';
    if (conditions === undefined) can(grant.action, grantSubject);
    else can(grant.action, grantSubject, conditions as never);
  }

  // Invariant, independent of what any role row says: system roles are immutable.
  cannot(['update', 'delete'], 'Role', { isSystem: true });

  return build();
}

export function defineAnonymousAbility(): AppAbility {
  return new AbilityBuilder<AppAbility>(createMongoAbility).build();
}

export function packAbility(ability: AppAbility): PackedRules {
  return packRules(ability.rules);
}

export function abilityFromPacked(rules: PackedRules): AppAbility {
  return createMongoAbility<AppAbility>(unpackRules(rules));
}

export type { ScopePreset };
