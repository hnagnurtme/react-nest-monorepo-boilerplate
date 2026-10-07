import { subject } from '@casl/ability';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthStore } from '@/entities/session';
import { AbilityProvider, CanAction, useAbility } from '@/features/auth';

function TestConsumer() {
  const ability = useAbility();
  return (
    <div>
      <span data-testid="can-read-user">{ability.can('read', 'User') ? 'yes' : 'no'}</span>
      <span data-testid="can-manage-all">{ability.can('manage', 'all') ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('AbilityProvider & CanAction', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', accessToken: null, user: null });
  });

  it('P1: anonymous user receives empty ability', () => {
    render(
      <AbilityProvider>
        <TestConsumer />
      </AbilityProvider>,
    );

    expect(screen.getByTestId('can-read-user').textContent).toBe('no');
    expect(screen.getByTestId('can-manage-all').textContent).toBe('no');
  });

  it('P2: PLATFORM_ADMIN gets manage all', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-admin',
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        fullName: 'Admin User',
        role: 'PLATFORM_ADMIN',
      },
    });

    render(
      <AbilityProvider>
        <TestConsumer />
      </AbilityProvider>,
    );

    expect(screen.getByTestId('can-manage-all').textContent).toBe('yes');
  });

  it('P3: TENANT_ADMIN can update users of own tenant but not another tenant', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-tenant',
      user: {
        id: 'ta-1',
        email: 'ta@example.com',
        fullName: 'Tenant Admin',
        role: 'TENANT_ADMIN',
        tenantId: 't1',
      },
    });

    const ownUser = subject('User', { id: 'u1', tenantId: 't1' });
    const otherUser = subject('User', { id: 'u2', tenantId: 't2' });

    render(
      <AbilityProvider>
        <CanAction I="update" a="User" this={ownUser}>
          <div data-testid="own-action">Edit own</div>
        </CanAction>
        <CanAction I="update" a="User" this={otherUser}>
          <div data-testid="other-action">Edit other</div>
        </CanAction>
      </AbilityProvider>,
    );

    expect(screen.getByTestId('own-action')).toBeInTheDocument();
    expect(screen.queryByTestId('other-action')).not.toBeInTheDocument();
  });

  it('P4: CanAction supports a function child', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-member',
      user: {
        id: 'm-1',
        email: 'm@example.com',
        fullName: 'Member',
        role: 'TENANT_MEMBER',
        tenantId: 't1',
      },
    });

    render(
      <AbilityProvider>
        <CanAction I="read" a="Tenant">
          {(isAllowed) => <button disabled={!isAllowed}>{isAllowed ? 'Open' : 'Disabled'}</button>}
        </CanAction>
      </AbilityProvider>,
    );

    expect(screen.getByRole('button')).toHaveTextContent('Open');
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('P5: TENANT_MEMBER can only update self, not tenant colleagues', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-member',
      user: {
        id: 'm-1',
        email: 'm@example.com',
        fullName: 'Member',
        role: 'TENANT_MEMBER',
        tenantId: 't1',
      },
    });

    const self = subject('User', { id: 'm-1', tenantId: 't1' });
    const colleague = subject('User', { id: 'm-2', tenantId: 't1' });

    render(
      <AbilityProvider>
        <CanAction I="update" a="User" this={self}>
          <div data-testid="self-action">Edit self</div>
        </CanAction>
        <CanAction I="update" a="User" this={colleague}>
          <div data-testid="colleague-action">Edit colleague</div>
        </CanAction>
      </AbilityProvider>,
    );

    expect(screen.getByTestId('self-action')).toBeInTheDocument();
    expect(screen.queryByTestId('colleague-action')).not.toBeInTheDocument();
  });

  it('P6: clearAuth resets ability to anonymous state', () => {
    useAuthStore.setState({
      status: 'authenticated',
      accessToken: 'token-admin',
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        fullName: 'Admin User',
        role: 'PLATFORM_ADMIN',
      },
    });

    const { rerender } = render(
      <AbilityProvider>
        <TestConsumer />
      </AbilityProvider>,
    );

    expect(screen.getByTestId('can-manage-all').textContent).toBe('yes');

    useAuthStore.getState().clearAuth();

    rerender(
      <AbilityProvider>
        <TestConsumer />
      </AbilityProvider>,
    );

    expect(screen.getByTestId('can-manage-all').textContent).toBe('no');
  });
});
