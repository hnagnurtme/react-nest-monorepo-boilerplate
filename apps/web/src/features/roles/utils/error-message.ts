import type { TFunction } from 'i18next';

import type { ApiError } from '@/lib/http/client';

const FORBIDDEN = 403;
const CONFLICT = 409;
const BAD_REQUEST = 400;
const UNPROCESSABLE = 422;

/** Maps an API failure on a role write to a translated message. */
export function roleErrorMessage(
  t: TFunction<'roles'>,
  error: ApiError,
  fallbackKey: string,
): string {
  switch (error.status) {
    case FORBIDDEN:
      return t('errors.forbidden');
    case CONFLICT:
      return t('errors.conflict');
    case BAD_REQUEST:
    case UNPROCESSABLE:
      return t('errors.invalid');
    default:
      return t(fallbackKey);
  }
}
