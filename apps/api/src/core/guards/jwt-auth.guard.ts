import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';

import { IS_PUBLIC_KEY, type AuthContext } from '@/common/index.js';
import { AccessTokenService, type AccessTokenPayload } from '@/core/auth/access-token.service.js';
import type { AuthzProfile } from '@/core/authz/index.js';
import { AuthzService } from '@/core/authz/index.js';
import { CLS_KEYS, type AccessContext, type AppClsStore } from '@/core/database/request-context.js';
import { UnauthenticatedError } from '@/core/errors/index.js';

const BEARER_PREFIX = 'Bearer ';

interface RequestLike {
  headers: { authorization?: string | undefined };
  user?: AuthContext;
}

/**
 * Derives the RLS access mode from the caller's authorization profile.
 *
 * This is the one place the two authorization systems meet: CASL decides which
 * actions a caller may attempt, and this decides how much of the table Postgres
 * will show them in the first place.
 *
 * A caller that is neither a platform user nor attached to a tenant is
 * rejected instead of being mapped to a default: there is no safe fallback for
 * "which tenant is this".
 */
export function accessContextFor(
  profile: Pick<AuthzProfile, 'userId' | 'scope' | 'tenantId'>,
): AccessContext {
  if (profile.scope === 'platform') {
    return { accessMode: 'admin', reason: `platform-user:${profile.userId}` };
  }

  if (profile.tenantId === null) {
    throw new UnauthenticatedError('Account has no tenant');
  }

  return { accessMode: 'tenant', tenantId: profile.tenantId };
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

    const request = context.switchToHttp().getRequest<RequestLike>();
    const token = extractBearerToken(request.headers.authorization);
    const payload = token === undefined ? undefined : await this.accessTokens.verify(token);

    if (payload !== undefined) {
      // Read from the database (cached), not from the token: a deactivated user
      // or a changed role must stop working now, not when the token expires.
      const profile = await this.authz.loadProfile(payload.sub);
      if (profile === undefined) throw new UnauthenticatedError('Account is no longer active');

      const authContext = toAuthContext(payload, profile);
      request.user = authContext;
      this.cls.set(CLS_KEYS.userId, profile.userId);
      this.cls.set(CLS_KEYS.tenantId, profile.tenantId ?? undefined);
      this.cls.set(CLS_KEYS.profile, profile);
      this.cls.set(CLS_KEYS.accessContext, accessContextFor(profile));
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

function toAuthContext(payload: AccessTokenPayload, profile: AuthzProfile): AuthContext {
  return {
    id: profile.userId,
    email: payload.email,
    tenantId: profile.tenantId ?? undefined,
    scope: profile.scope,
    roles: profile.roles.map((role) => role.key),
    jti: payload.jti,
  };
}
