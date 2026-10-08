import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';

import { AppConfig, envSchema, type EnvConfig } from '@/config/index.js';
import { AccessTokenService } from '@/core/auth/access-token.service.js';
import type { RedisService } from '@/core/redis/index.js';
import type { PublicUser } from '@/modules/auth/auth.types.js';
import { TokenService } from '@/modules/auth/token.service.js';

const env: EnvConfig = envSchema.parse({
  DATABASE_URL: 'postgres://app@localhost:5432/db',
  MIGRATION_DATABASE_URL: 'postgres://owner@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
});

const user: PublicUser = {
  id: 'u-1',
  email: 'a@example.test',
  fullName: 'A',
  tenantId: 't-1',
  tenants: [{ id: 't-1', name: 'Acme' }],
  scope: 'tenant',
  roles: [{ key: 'TENANT_ADMIN', name: 'Tenant administrator' }],
};

/** Redis only backs the revocation denylist, which these tests do not exercise. */
function fakeRedis(): RedisService {
  return {
    exists: vi.fn().mockResolvedValue(false),
    setWithTtl: vi.fn().mockResolvedValue(undefined),
  } as unknown as RedisService;
}

function makeService(overrides: Partial<EnvConfig> = {}): TokenService {
  const config = new AppConfig({ ...env, ...overrides });
  return new TokenService(new AccessTokenService(new JwtService({}), config, fakeRedis()), config);
}

function decode(token: string, secret: string): Record<string, unknown> {
  return new JwtService({}).verify<Record<string, unknown>>(token, { secret });
}

describe('TokenService', () => {
  it('signs an access token carrying the identity the guard needs', async () => {
    const issued = await makeService().issueAccessToken(user);

    expect(decode(issued.token, env.JWT_ACCESS_SECRET)).toMatchObject({
      sub: 'u-1',
      email: 'a@example.test',
      jti: issued.jti,
    });
  });

  it('carries no role, scope or tenant: those are read from the database on every request', async () => {
    const issued = await makeService().issueAccessToken(user);
    const claims = decode(issued.token, env.JWT_ACCESS_SECRET);

    expect(claims).not.toHaveProperty('role');
    expect(claims).not.toHaveProperty('scope');
    expect(claims).not.toHaveProperty('tenantId');
  });

  it('refuses an access token verified with the refresh secret', async () => {
    const issued = await makeService().issueAccessToken(user);

    // The two secrets exist precisely so one cannot stand in for the other.
    expect(() => decode(issued.token, env.JWT_REFRESH_SECRET)).toThrow();
  });

  it('issues an unpredictable refresh token and keeps only its digest', () => {
    const service = makeService();
    const first = service.issueRefreshToken();
    const second = service.issueRefreshToken();

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toContain(first.token);
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('hashes deterministically, so the rotation lookup can find the row', () => {
    const service = makeService();
    const issued = service.issueRefreshToken();

    expect(service.hashRefreshToken(issued.token)).toBe(issued.tokenHash);
  });

  it('keys the digest with the refresh secret', () => {
    const token = makeService().issueRefreshToken();
    const other = makeService({ JWT_REFRESH_SECRET: 'c'.repeat(32) });

    // A database dump alone is not enough to match a token against a row.
    expect(other.hashRefreshToken(token.token)).not.toBe(token.tokenHash);
  });

  it('dates the refresh token by the configured TTL', () => {
    const issued = makeService().issueRefreshToken();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(issued.expiresAt.getTime() - Date.now()).toBeGreaterThan(sevenDaysMs - 5000);
  });
});
