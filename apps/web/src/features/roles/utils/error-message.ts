import type { TFunction } from 'i18next';

import type { ApiError } from '@/lib/http/client';
import { apiErrorKind } from '@/lib/http/error-message';

/**
 * Role writes fail in ways that need their own wording (a name clash and a role
 * still assigned to users are both 409), so the shared classifier decides the
 * kind and this map supplies the sentence.
 */
export function roleErrorMessage(
  t: TFunction<'roles'>,
  error: ApiError,
  fallbackKey: 'create.error' | 'editor.renameError' | 'editor.saveError' | 'editor.deleteError',
): string {
  switch (apiErrorKind(error)) {
    case 'forbidden':
      return t('errors.forbidden');
    case 'conflict':
      return t('errors.conflict');
    case 'invalid':
      return t('errors.invalid');
    case 'notFound':
    case 'unexpected':
      return t(fallbackKey);
  }
}
