import { subject } from '@casl/ability';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/entities/session';
import { AbilityProvider, CanAction, useAbility, useAbilityLoading } from '@/features/auth';

import {
  ABILITIES_URL,
  jsonResponse,
  makePlatformAdmin,
  makeTenantAdmin,
  makeUser,
  MEMBER_GRANTS,
  packedRulesFor,
  PLATFORM_ADMIN_GRANTS,
  setSessionUser,
  TENANT_ADMIN_GRANTS,
} from './fixtures/auth';

function TestConsumer() {
  const ability = useAbility();
  const isLoading = useAbilityLoading();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'yes' : 'no'}</span>
      <span data-testid="can-read-user">{ability.can('read', 'User') ? 'yes' : 'no'}</span>
      <span data-testid="can-manage-all">{ability.can('manage', 'all') ? 'yes' : 'no'}</span>
    </div>
  );
}

function renderProvider(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AbilityProvider>{children}</AbilityProvider>
    </QueryClientProvider>,
  );
}

function stubRules(rules: unknown) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes(ABILITIES_URL)) return Promise.resolve(jsonResponse({ data: { rules } }));
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('AbilityProvider & CanAction', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('anonymous user gets an empty ability and never calls the API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderProvider(<TestConsumer />);

    expect(screen.getByTestId('can-read-user').textContent).toBe('no');
    expect(screen.getByTestId('loading').textContent).toBe('no');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is loading, then exposes the unpacked rules of the API', async () => {
    const user = makePlatformAdmin();
    setSessionUser(user);
    stubRules(packedRulesFor(user, PLATFORM_ADMIN_GRANTS));
    renderProvider(<TestConsumer />);

    expect(screen.getByTestId('loading').textContent).toBe('yes');
    expect(screen.getByTestId('can-manage-all').textContent).toBe('no');

    await waitFor(() => {
      expect(screen.getByTestId('can-manage-all').textContent).toBe('yes');
    });
    expect(screen.getByTestId('loading').textContent).toBe('no');
  });

  it('a tenant admin can update users of their tenant but not another tenant', async () => {
    const user = makeTenantAdmin({ tenantId: 't1' });
    setSessionUser(user);
    stubRules(packedRulesFor(user, TENANT_ADMIN_GRANTS));

    const ownUser = subject('User', { id: 'u1', tenantId: 't1' });
    const otherUser = subject('User', { id: 'u2', tenantId: 't2' });

    renderProvider(
      <>
        <CanAction I="update" a="User" this={ownUser}>
          <div data-testid="own-action">Edit own</div>
        </CanAction>
        <CanAction I="update" a="User" this={otherUser}>
          <div data-testid="other-action">Edit other</div>
        </CanAction>
      </>,
    );

    expect(await screen.findByTestId('own-action')).toBeInTheDocument();
    expect(screen.queryByTestId('other-action')).not.toBeInTheDocument();
  });

  it('a member can only update themself, not colleagues', async () => {
    const user = makeUser({ id: 'm-1', tenantId: 't1' });
    setSessionUser(user);
    stubRules(packedRulesFor(user, MEMBER_GRANTS));

    renderProvider(
      <>
        <CanAction I="update" a="User" this={subject('User', { id: 'm-1', tenantId: 't1' })}>
          <div data-testid="self-action">Edit self</div>
        </CanAction>
        <CanAction I="update" a="User" this={subject('User', { id: 'm-2', tenantId: 't1' })}>
          <div data-testid="colleague-action">Edit colleague</div>
        </CanAction>
      </>,
    );

    expect(await screen.findByTestId('self-action')).toBeInTheDocument();
    expect(screen.queryByTestId('colleague-action')).not.toBeInTheDocument();
  });

  it('CanAction supports a function child', async () => {
    const user = makeUser({ tenantId: 't1' });
    setSessionUser(user);
    stubRules(packedRulesFor(user, MEMBER_GRANTS));

    renderProvider(
      <CanAction I="read" a="Tenant">
        {(isAllowed) => <button disabled={!isAllowed}>{isAllowed ? 'Open' : 'Disabled'}</button>}
      </CanAction>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveTextContent('Open');
    });
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('falls back to the empty ability when the rules cannot be loaded', async () => {
    setSessionUser(makePlatformAdmin());
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ status: 500, code: 'INTERNAL' }, 500)),
    );
    renderProvider(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('no');
    });
    expect(screen.getByTestId('can-manage-all').textContent).toBe('no');
  });

  it('refetches for a new access token (refresh) and resets on sign-out', async () => {
    const user = makePlatformAdmin();
    setSessionUser(user);
    const fetchMock = stubRules(packedRulesFor(user, PLATFORM_ADMIN_GRANTS));
    renderProvider(<TestConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('can-manage-all').textContent).toBe('yes');
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    useAuthStore.getState().setAuth('token-2', user);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    // The previous rules stay in place meanwhile (no flash).
    expect(screen.getByTestId('can-manage-all').textContent).toBe('yes');

    useAuthStore.getState().clearAuth();
    await waitFor(() => {
      expect(screen.getByTestId('can-manage-all').textContent).toBe('no');
    });
  });
});
