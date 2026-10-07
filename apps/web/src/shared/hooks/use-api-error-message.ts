import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { ApiError } from '@/lib/http/client';
import { apiErrorKind } from '@/lib/http/error-message';

const KIND_KEYS = {
  forbidden: 'errors.forbidden',
  notFound: 'errors.notFound',
  conflict: 'errors.conflict',
  invalid: 'errors.invalid',
  unexpected: 'errors.unexpected',
} as const;

export type ApiErrorFormatter = (error: ApiError, fallback?: string) => string;

/**
 * Turns an API failure into a translated sentence. Features pass `fallback` for
 * the case the server did not classify (5xx, network), so a page can still say
 * what the user was trying to do.
 */
export function useApiErrorMessage(): ApiErrorFormatter {
  const { t } = useTranslation('common');

  return useCallback(
    (error: ApiError, fallback?: string) => {
      const kind = apiErrorKind(error);
      if (kind === 'unexpected' && fallback !== undefined) return fallback;
      return t(KIND_KEYS[kind]);
    },
    [t],
  );
}
