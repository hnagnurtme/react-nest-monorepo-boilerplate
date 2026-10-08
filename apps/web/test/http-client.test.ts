import { afterEach, describe, expect, it, vi } from 'vitest';

import { rawRequest, resetHttpClientForTests, setTenantProvider } from '@/lib/http/client';

describe('http client', () => {
  afterEach(() => {
    document.cookie = 'csrf_token=; Max-Age=0; path=/';
    resetHttpClientForTests();
    vi.unstubAllGlobals();
  });

  it('copies the readable CSRF cookie into unsafe request headers', async () => {
    document.cookie = 'csrf_token=csrf-value; path=/';
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null })));
    vi.stubGlobal('fetch', fetchMock);

    await rawRequest('/api/v1/auth/login', { method: 'POST', body: '{}' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(options.headers);

    expect(headers.get('x-csrf-token')).toBe('csrf-value');
  });

  it('names the tenant every authenticated request acts in', async () => {
    setTenantProvider(() => 'tenant-7');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null })));
    vi.stubGlobal('fetch', fetchMock);

    await rawRequest('/api/v1/users', { method: 'GET' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(options.headers).get('x-tenant-id')).toBe('tenant-7');
  });

  it('sends no tenant header before the account has chosen one', async () => {
    setTenantProvider(() => null);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: null })));
    vi.stubGlobal('fetch', fetchMock);

    await rawRequest('/api/v1/auth/me', { method: 'GET' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(options.headers).get('x-tenant-id')).toBeNull();
  });
});
