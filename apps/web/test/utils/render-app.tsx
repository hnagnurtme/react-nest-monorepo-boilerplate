import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { AppCore } from '@/app/app';
import { useAuthStore } from '@/entities/session/store';
import { broadcastLogout, broadcastRefreshed } from '@/entities/session/sync';
import { setTokenProvider, setUnauthorizedHandler } from '@/lib/http/client';
import { setRefreshHandler } from '@/lib/http/refresh';

interface RenderAppOptions {
  initialRoute?: string;
  strictMode?: boolean;
  queryClient?: QueryClient;
}

export function renderApp({
  initialRoute = '/',
  strictMode = false,
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
}: RenderAppOptions = {}): ReturnType<typeof render> {
  // Setup handlers like in main.tsx
  setTokenProvider(() => useAuthStore.getState().accessToken);

  setUnauthorizedHandler(() => {
    useAuthStore.getState().clearAuth();
    broadcastLogout();
  });

  setRefreshHandler((outcome) => {
    const store = useAuthStore.getState();

    switch (outcome.kind) {
      case 'refreshed':
        store.setAuth(outcome.accessToken, outcome.user as never);
        broadcastRefreshed(outcome.accessToken, outcome.user);
        break;

      case 'unauthenticated':
        store.clearAuth();
        broadcastLogout();
        break;

      case 'reuse-detected':
        store.clearAuth();
        broadcastLogout();
        break;

      case 'unavailable':
        if (store.status === 'initializing') {
          store.clearAuth();
        }
        break;
    }
  });

  const ui = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <AppCore />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return render(strictMode ? <StrictMode>{ui}</StrictMode> : ui);
}
