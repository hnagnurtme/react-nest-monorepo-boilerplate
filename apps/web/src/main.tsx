import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/lib/i18n';

import '@/app/styles/globals.css';

import { App } from '@/app/app';
import { useAuthStore } from '@/entities/session/store';
import { broadcastLogout, broadcastRefreshed } from '@/entities/session/sync';
import { setTenantProvider, setTokenProvider, setUnauthorizedHandler } from '@/lib/http/client';
import { setRefreshHandler } from '@/lib/http/refresh';

setTokenProvider(() => useAuthStore.getState().accessToken);
setTenantProvider(() => useAuthStore.getState().activeTenantId);

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
      // Network/server error: don't logout, but move from initializing to anonymous
      if (store.status === 'initializing') {
        store.clearAuth();
      }
      break;
  }
});

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
