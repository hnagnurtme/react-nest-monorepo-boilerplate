import { describe, expect, it } from 'vitest';

import { createHealthStatus } from '@repo/shared-types';

describe('Health Status', () => {
  it('creates a healthy status payload', () => {
    expect(createHealthStatus('api')).toEqual({
      service: 'api',
      status: 'ok',
    });
  });
});
