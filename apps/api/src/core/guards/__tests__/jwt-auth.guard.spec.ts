import { describe, expect, it } from 'vitest';

import { UnauthenticatedError } from '@/core/errors/index.js';
import { accessContextFor } from '@/core/guards/jwt-auth.guard.js';

describe('accessContextFor', () => {
  it('runs platform users in admin mode, with the reason recorded', () => {
    expect(accessContextFor({ userId: 'p', scope: 'platform', tenantId: null })).toEqual({
      accessMode: 'admin',
      reason: 'platform-user:p',
    });
  });

  it('pins tenant users to their tenant', () => {
    expect(accessContextFor({ userId: 'u', scope: 'tenant', tenantId: 't-1' })).toEqual({
      accessMode: 'tenant',
      tenantId: 't-1',
    });
  });

  it('fails closed for a user that is neither platform nor attached to a tenant', () => {
    expect(() => accessContextFor({ userId: 'u', scope: 'tenant', tenantId: null })).toThrow(
      UnauthenticatedError,
    );
  });
});
