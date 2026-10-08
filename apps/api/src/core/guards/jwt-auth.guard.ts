import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';

import { IS_PUBLIC_KEY, NO_TENANT_CONTEXT_KEY, type AuthContext } from '@/common/index.js';
import { AccessTokenService, type AccessTokenPayload } from '@/core/auth/access-token.service.js';
import type { AuthzProfile } from '@/core/authz/index.js';
import { AuthzService } from '@/core/authz/index.js';
import { CLS_KEYS, type AccessContext, type AppClsStore } from '@/core/database/request-context.js';
import { UnauthenticatedError } from '@/core/errors/index.js';

const BEARER_PREFIX = 'Bearer ';
export const TENANT_HEADER = 'x-tenant-id';

interface RequestLike {
  headers: { authorization?: string | undefined; [TENANT_HEADER]?: string | string[] | undefined };
  user?: AuthContext;
}

/**
 * Derives the RLS access mode from the caller's authorization profile and the
 * tenant they asked to act in.
 *
 * This is the one place the two authorization systems meet: CASL decides which
 * actions a caller may attempt, and this decides how much of the table Postgres
 * will show them in the first place.
 *
 * An account can belong to several tenants, so the tenant comes from the
 * request (`x-tenant-id`) — but only ever as a choice among the memberships the
 * database reports. A header naming a tenant the account does not belong to is
 * rejected rather than mapped to a default: there is no safe fallback for
 * "which tenant is this". A missing header is rejected for the same reason,
 * even when the account has exactly one tenant; routes that have to work before
 * the choice is made say so with `@NoTenantContext()`.
 */
export function accessContextFor(
  profile: Pick<AuthzProfile, 'userId' | 'scope' | 'tenants'>,
  requestedTenantId: string | undefined,
): AccessContext {
  if (profile.scope === 'platform') {
    return { accessMode: 'admin', reason: `platform-user:${profile.userId}` };
  }

  if (requestedTenantId === undefined) {
    throw new UnauthenticatedError(`Missing ${TENANT_HEADER} header`);
  }
  if (!profile.tenants.some((tenant) => tenant.id === requestedTenantId)) {
    throw new UnauthenticatedError('Account does not belong to that tenant');
  }

  return { accessMode: 'tenant', tenantId: requestedTenantId };
}

/**
 * Registered globally, so a route is protected unless it says otherwise with
 * `@Public()`. The fail-safe direction matters: forgetting the decorator locks
 * an endpoint down rather than opening it up
 * (docs/rules/07-security.md B5).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AccessTokenService) private readonly accessTokens: AccessTokenService,
    @Inject(AuthzService) private readonly authz: AuthzService,
    @Inject(ClsService) private readonly cls: ClsService<AppClsStore>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipsTenantContext = this.reflector.getAllAndOverride<boolean>(NO_TENANT_CONTEXT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestLike>();
    const token = extractBearerToken(request.headers.authorization);
    const payload = token === undefined ? undefined : await this.accessTokens.verify(token);

    if (payload !== undefined) {
      // Read from the database (cached), not from the token: a deactivated user
      // or a changed role must stop working now, not when the token expires.
      const profile = await this.authz.loadProfile(payload.sub);
      if (profile === undefined) throw new UnauthenticatedError('Account is no longer active');

      const requestedTenantId = readTenantHeader(request);
      // `@NoTenantContext()` tolerates a caller that has not chosen yet — it
      // does not ignore a choice. A header naming a tenant the account does not
      // belong to is still rejected, and one that fits is still honoured, so
      // `GET /auth/me/abilities` answers for the chosen tenant.
      const accessContext =
        skipsTenantContext && profile.scope !== 'platform' && requestedTenantId === undefined
          ? undefined
          : accessContextFor(profile, requestedTenantId);
      const activeTenantId =
        accessContext?.accessMode === 'tenant' ? accessContext.tenantId : undefined;

      const authContext = toAuthContext(payload, profile, activeTenantId);
      request.user = authContext;
      this.cls.set(CLS_KEYS.userId, profile.userId);
      this.cls.set(CLS_KEYS.tenantId, activeTenantId);
      this.cls.set(CLS_KEYS.activeTenantId, activeTenantId);
      this.cls.set(CLS_KEYS.profile, profile);
      this.cls.set(CLS_KEYS.accessContext, accessContext);
      this.cls.set(CLS_KEYS.authContext, authContext);
      return true;
    }

    // A public route without a valid token gets no access context at all, so a
    // stray query on it reads zero rows (fail-closed) instead of any data.
    if (isPublic) return true;

    throw new UnauthenticatedError(
      token === undefined ? 'Missing bearer token' : 'Access token is invalid or expired',
    );
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith(BEARER_PREFIX)) return undefined;
  return header.slice(BEARER_PREFIX.length);
}

/** A repeated header is not a choice, so it is treated as none at all. */
function readTenantHeader(request: RequestLike): string | undefined {
  const raw = request.headers[TENANT_HEADER];
  if (typeof raw !== 'string') return undefined;
  const value = raw.trim();
  return value === '' ? undefined : value;
}

function toAuthContext(
  payload: AccessTokenPayload,
  profile: AuthzProfile,
  activeTenantId: string | undefined,
): AuthContext {
  return {
    id: profile.userId,
    email: payload.email,
    ...(activeTenantId === undefined ? {} : { tenantId: activeTenantId }),
    tenantIds: profile.tenants.map((tenant) => tenant.id),
    scope: profile.scope,
    roles: profile.roles.map((role) => role.key),
    jti: payload.jti,
  };
}
