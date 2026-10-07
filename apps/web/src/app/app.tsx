import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { env } from '@/config/env';
import { useAuthStore, useSessionSync } from '@/entities/session';
import { useInitAuthSession } from '@/features/auth';
import { PageLoader } from '@/shared/ui';

import { AppProviders } from './providers';
import { AppRouter } from './router';

/**
 * Core app logic without router (for testing).
 */
export function AppCore() {
  useEffect(() => {
    document.title = env.VITE_APP_NAME;
  }, []);

  useInitAuthSession();
  useSessionSync();

  const status = useAuthStore((state) => state.status);

  if (status === 'initializing') {
    return <PageLoader />;
  }

  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

/**
 * Production app with BrowserRouter.
 */
export function App() {
  return (
    <BrowserRouter>
      <AppCore />
    </BrowserRouter>
  );
}
