import { useEffect } from 'react';

import { useAuthStore } from '@/entities/session';
import { refreshSession } from '@/lib/http/refresh';

/**
 * Initialize auth session on app mount by attempting to refresh from httpOnly cookie.
 * Only runs once when status is 'initializing'.
 * Does not show toast errors - silent rehydration.
 */
export function useInitAuthSession(): void {
  const status = useAuthStore((state) => state.status);

  useEffect(() => {
    if (status === 'initializing') {
      // refreshHandler will update store, no need to handle result here
      void refreshSession();
    }
  }, [status]);
}
