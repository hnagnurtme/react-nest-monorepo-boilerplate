import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { vi, type Mock } from 'vitest';

import type { PermissionGrant } from '@repo/shared-types';

import type { PublicUser } from '@/entities/session';
import { AbilityProvider, useAbilityLoading } from '@/features/auth';
import { ThemeProvider } from '@/shared/components';
import { ToastProvider } from '@/shared/ui';

import { abilitiesResponse, ABILITIES_URL, setSessionUser } from './fixtures/auth';

export type MockedFetch = Mock<(url: string, init?: RequestInit) => Promise<Response>>;

export type FetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>;

/**
 * Signs the user in and stubs fetch: the abilities endpoint answers with the packed rules
 * of `grants`, everything else goes to `handler`.
 */
export function mockApi(
  user: PublicUser,
  grants: readonly PermissionGrant[],
  handler: FetchHandler = () => new Response(null, { status: 404 }),
): MockedFetch {
  setSessionUser(user);
  const fetchMock = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation((url, init) =>
      Promise.resolve(
        url.includes(ABILITIES_URL) ? abilitiesResponse(user, grants) : handler(url, init),
      ),
    );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Holds the children back until the ability has loaded, so assertions are deterministic. */
function AbilityReady({ children }: { children: ReactNode }): ReactNode {
  return useAbilityLoading() ? null : children;
}

export function renderWithProviders(
  ui: ReactNode,
  initialEntries: string[] = ['/'],
): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AbilityProvider>
            <AbilityReady>
              <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
            </AbilityReady>
          </AbilityProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
