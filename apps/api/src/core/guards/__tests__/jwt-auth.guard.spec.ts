import { describe, expect, it } from 'vitest';

import { UnauthenticatedError } from '@/core/errors/index.js';
import { accessContextFor } from '@/core/guards/jwt-auth.guard.js';

const ACME = { id: 't-1', name: 'Acme', slug: 'acme' };
const GLOBEX = { id: 't-2', name: 'Globex', slug: 'globex' };

describe('accessContextFor', () => {
  it('runs platform users in admin mode, with the reason recorded', () => {
    expect(accessContextFor({ userId: 'p', scope: 'platform', tenants: [] }, undefined)).toEqual({
      accessMode: 'admin',
      reason: 'platform-user:p',
    });
  });

  it('acts in the tenant the caller asked for', () => {
    expect(
      accessContextFor({ userId: 'u', scope: 'tenant', tenants: [ACME, GLOBEX] }, 't-2'),
    ).toEqual({ accessMode: 'tenant', tenantId: 't-2' });
  });

  it('rejects a tenant the account does not belong to', () => {
    expect(() =>
      accessContextFor({ userId: 'u', scope: 'tenant', tenants: [ACME] }, 't-2'),
    ).toThrow(UnauthenticatedError);
  });

  it('rejects a missing choice, even with a single membership', () => {
    expect(() =>
      accessContextFor({ userId: 'u', scope: 'tenant', tenants: [ACME] }, undefined),
    ).toThrow(UnauthenticatedError);
  });

  it('fails closed for an account with no tenant at all', () => {
    expect(() => accessContextFor({ userId: 'u', scope: 'tenant', tenants: [] }, 't-1')).toThrow(
      UnauthenticatedError,
    );
  });
});
