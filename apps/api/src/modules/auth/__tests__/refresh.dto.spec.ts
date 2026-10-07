import { describe, expect, it } from 'vitest';

import { refreshSchema } from '@/modules/auth/dto/index.js';

describe('refreshSchema', () => {
  it('accepts a missing body: browsers send the token as a cookie, not in a body', () => {
    expect(refreshSchema.parse(undefined)).toEqual({});
  });

  it('accepts a body token and rejects unknown fields', () => {
    expect(refreshSchema.parse({ refreshToken: 'abc' })).toEqual({ refreshToken: 'abc' });
    expect(refreshSchema.safeParse({ tenantId: 'x' }).success).toBe(false);
  });
});
