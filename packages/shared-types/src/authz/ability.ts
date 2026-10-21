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
 * Turns a stored preset into CASL conditions for one (action, subject).
 *
 * The preset is a closed vocabulary on purpose: tenants pick how far a
 * permission reaches but never author a query, so a role cannot be crafted to
 * match rows outside its tenant. Returns `null` when the combination is
 * meaningless, and the grant is then dropped (fail closed).
 *
 * An **array** means one grant that reaches two disjoint sets of rows, and
 * `buildAbility` turns it into one `can` rule per entry. CASL's mongo matcher
 * reads `$or` as a field named `$or`, not as a disjunction, so a union has to
 * be several rules — rules are OR-ed by CASL itself.
 */
export function conditionsFor(
  grant: PermissionGrant,
  user: UserContext,
): Conditions | Conditions[] | undefined | null {
  if (grant.preset === 'any') return undefined;
  if (user.tenantId === undefined) return null;

  const { subject, preset } = grant;

  if (preset === 'own_record') {
    // 'own_record' means a different column per subject, so every subject that
    // offers the preset needs a branch here. A subject without one falls
    // through to null and the grant is dropped — fail closed, never "all rows".
    switch (subject) {
      case 'User':
        return { id: user.id };
      default:
        return null;
    }
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
    if (conditions === undefined) {
      can(grant.action, grantSubject);
      continue;
    }
    /* An array is a union: one rule each, and CASL OR-s its own rules. */
    for (const condition of Array.isArray(conditions) ? conditions : [conditions]) {
      can(grant.action, grantSubject, condition as never);
    }
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
