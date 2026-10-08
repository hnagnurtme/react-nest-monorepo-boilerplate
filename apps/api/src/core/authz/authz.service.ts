import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import {
  buildAbility,
  defineAnonymousAbility,
  type AppAbility,
  type PermissionGrant,
} from '@repo/shared-types';

import { CLS_KEYS, type AppClsStore } from '@/core/database/request-context.js';
import { TransactionManager } from '@/core/database/transaction.manager.js';
import { RedisService } from '@/core/redis/index.js';

import { AuthzRepository } from './authz.repository.js';
import type { AuthzProfile } from './authz.types.js';

const CACHE_PREFIX = 'authz:profile:';
/** Short on purpose: explicit invalidation is the primary mechanism, this is the safety net. */
const CACHE_TTL_SECONDS = 300;

/**
 * Resolves what a user may do. The profile (roles + grants) comes from the
 * database, is cached in Redis, and is evicted whenever a role, a grant or an
 * assignment changes — so permissions are live without a deploy and without
 * waiting for tokens to expire.
 */
@Injectable()
export class AuthzService {
  constructor(
    @Inject(TransactionManager) private readonly transactions: TransactionManager,
    @Inject(AuthzRepository) private readonly repository: AuthzRepository,
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(ClsService) private readonly cls: ClsService<AppClsStore>,
  ) {}

  /** `undefined` when the user no longer exists or is inactive. */
  async loadProfile(userId: string): Promise<AuthzProfile | undefined> {
    const cached = await this.readCache(userId);
    if (cached !== undefined) return cached;

    const rows = await this.transactions.run(
      { accessMode: 'admin', reason: 'authz:load-profile' },
      async (tx) => this.repository.loadProfileRows(tx, userId),
    );
    if (rows === undefined) return undefined;

    const profile: AuthzProfile = {
      ...rows,
      scope: rows.roles.some((role) => role.scope === 'platform') ? 'platform' : 'tenant',
    };
    await this.redis.setWithTtl(
      `${CACHE_PREFIX}${userId}`,
      JSON.stringify(profile),
      CACHE_TTL_SECONDS,
    );

    return profile;
  }

  /** The caller's profile as stored by the auth guard, `undefined` on a public route. */
  currentProfile(): AuthzProfile | undefined {
    return this.cls.get(CLS_KEYS.profile);
  }

  /** The tenant this request acts in, as validated by the auth guard. */
  activeTenantId(): string | undefined {
    return this.cls.get(CLS_KEYS.activeTenantId);
  }

  /**
   * The grants the caller holds right now: the ones from the active tenant plus
   * any platform-scope ones. Grants from the account's other tenants are not
   * included — that is the whole point of keeping them apart.
   */
  currentGrants(): PermissionGrant[] {
    const profile = this.cls.get(CLS_KEYS.profile);
    if (profile === undefined) return [];
    return grantsFor(profile, this.cls.get(CLS_KEYS.activeTenantId));
  }

  /** The ability of the request's caller, built from the profile the auth guard stored. */
  current(): AppAbility {
    const profile = this.cls.get(CLS_KEYS.profile);
    if (profile === undefined) return defineAnonymousAbility();
    return this.abilityFor(profile, this.cls.get(CLS_KEYS.activeTenantId));
  }

  abilityFor(profile: AuthzProfile, activeTenantId: string | undefined): AppAbility {
    return buildAbility(grantsFor(profile, activeTenantId), {
      id: profile.userId,
      ...(activeTenantId === undefined ? {} : { tenantId: activeTenantId }),
    });
  }

  async invalidateUsers(userIds: readonly string[]): Promise<void> {
    await Promise.all(userIds.map(async (id) => this.redis.delete(`${CACHE_PREFIX}${id}`)));
  }

  async invalidateRole(roleId: string): Promise<void> {
    const userIds = await this.transactions.run(
      { accessMode: 'admin', reason: 'authz:invalidate-role' },
      async (tx) => this.repository.userIdsWithRole(tx, roleId),
    );
    await this.invalidateUsers(userIds);
  }

  private async readCache(userId: string): Promise<AuthzProfile | undefined> {
    const raw = await this.redis.get(`${CACHE_PREFIX}${userId}`);
    if (raw === null) return undefined;

    try {
      return JSON.parse(raw) as AuthzProfile;
    } catch {
      // A corrupt entry is a cache miss, never an outage.
      return undefined;
    }
  }
}

/**
 * `own_tenant` conditions are built from the tenant the request acts in, so a
 * caller with no active tenant (a platform user, or one that has not chosen
 * yet) only keeps the grants that do not depend on one.
 */
function grantsFor(profile: AuthzProfile, activeTenantId: string | undefined): PermissionGrant[] {
  const tenantGrants =
    activeTenantId === undefined ? [] : (profile.grantsByTenant[activeTenantId] ?? []);
  return [...profile.platformGrants, ...tenantGrants];
}
