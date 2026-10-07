import { describe, expect, it } from 'vitest';

import { SYSTEM_ROLES, buildAbility, packAbility } from '@repo/shared-types';

import { parsePackedRules } from '@/features/auth/ability/packed-rules.schema';

describe('parsePackedRules', () => {
  it('accepts what the API sends (packed CASL rules)', () => {
    const rules = packAbility(
      buildAbility(SYSTEM_ROLES.TENANT_ADMIN.grants, { id: 'u', tenantId: 't' }),
    );

    expect(parsePackedRules(rules)).toEqual(rules);
  });

  it('rejects anything that is not packed rules, so the UI grants nothing', () => {
    expect(parsePackedRules(undefined)).toBeUndefined();
    expect(parsePackedRules('read')).toBeUndefined();
    expect(parsePackedRules({ rules: [] })).toBeUndefined();
    expect(parsePackedRules([['read', 'User'], 'oops'])).toBeUndefined();
    expect(parsePackedRules([[() => 'x']])).toBeUndefined();
  });

  it('bounds the number of rules', () => {
    expect(parsePackedRules(Array.from({ length: 501 }, () => ['read', 'User']))).toBeUndefined();
  });
});
