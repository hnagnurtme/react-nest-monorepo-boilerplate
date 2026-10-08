import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AbilityProvider } from '@/features/auth';
import { ThemeProvider, ToastProvider } from '@/shared/ui';

import { ErrorBoundary } from './components/error-boundary';

/**
 * Admin lists change under the user's feet (another admin edits a role), so the
 * window where a cached page is served without a background refetch is short.
 * Mutations still invalidate explicitly; this only covers changes made elsewhere.
 */
const STALE_TIME_MS = 30_000;

export function AppProviders({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('auth');
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider closeLabel={t('common.closeNotification')}>
            <AbilityProvider>{children}</AbilityProvider>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
