import { describe, expect, it } from 'vitest';

import { envSchema } from '@/config/env.schema.js';

const base = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/db',
  MIGRATION_DATABASE_URL: 'postgres://owner:owner@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

function issuePaths(input: Record<string, unknown>): string[] {
  const result = envSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('envSchema', () => {
  it('accepts a minimal valid environment', () => {
    expect(envSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a short JWT secret', () => {
    expect(issuePaths({ ...base, JWT_ACCESS_SECRET: 'tooshort' })).toContain('JWT_ACCESS_SECRET');
  });

  it('rejects reusing one secret for both token types', () => {
    // A shared secret means a leaked access secret can mint refresh tokens.
    expect(issuePaths({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toContain(
      'JWT_REFRESH_SECRET',
    );
  });

  it('rejects running the app on the migration connection', () => {
    // Same URL means the app runs as the table owner, which silently disables
    // every RLS policy.
    expect(issuePaths({ ...base, MIGRATION_DATABASE_URL: base.DATABASE_URL })).toContain(
      'DATABASE_URL',
    );
  });

  it('requires a secure cookie in production', () => {
    const paths = issuePaths({
      ...base,
      NODE_ENV: 'production',
      COOKIE_SECURE: 'false',
      COOKIE_DOMAIN: 'example.com',
    });

    expect(paths).toContain('COOKIE_SECURE');
  });

  it('requires a cookie domain in production', () => {
    expect(issuePaths({ ...base, NODE_ENV: 'production' })).toContain('COOKIE_DOMAIN');
  });

  it('allows a blank OTLP endpoint to mean "export disabled"', () => {
    const result = envSchema.safeParse({ ...base, OTEL_EXPORTER_OTLP_ENDPOINT: '' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it('splits CORS_ORIGINS on commas and trims the entries', () => {
    const result = envSchema.safeParse({ ...base, CORS_ORIGINS: 'http://a.test, http://b.test ' });

    expect(result.success && result.data.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('refuses an Argon2 memory cost below the OWASP minimum', () => {
    expect(issuePaths({ ...base, ARGON2_MEMORY_COST: '1024' })).toContain('ARGON2_MEMORY_COST');
  });
});
