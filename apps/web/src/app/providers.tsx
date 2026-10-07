import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AbilityProvider } from '@/features/auth';
import { ToastProvider } from '@/shared/ui';

import { ErrorBoundary } from './components/error-boundary';

const STALE_MINUTES = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const STALE_TIME_MS = STALE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

export function AppProviders({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('auth');
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME_MS,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider closeLabel={t('common.closeNotification')}>
          <AbilityProvider>{children}</AbilityProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
