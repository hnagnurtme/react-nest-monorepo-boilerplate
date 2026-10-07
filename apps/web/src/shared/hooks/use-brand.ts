import { useTranslation } from 'react-i18next';

import { env } from '@/config/env';

export interface Brand {
  name: string;
  slogan: string;
  thumbnailUrl: string | undefined;
}

/**
 * The product identity, configured per deployment through `VITE_APP_NAME`,
 * `VITE_APP_SLOGAN` and `VITE_APP_THUMBNAIL_URL` so a fork never edits JSX or
 * locale files just to rebrand. The slogan falls back to the translated
 * tagline, which keeps it localised when the env var is not set.
 */
export function useBrand(): Brand {
  const { t } = useTranslation('auth');

  return {
    name: env.VITE_APP_NAME,
    slogan: env.VITE_APP_SLOGAN ?? t('header.tagline'),
    thumbnailUrl: env.VITE_APP_THUMBNAIL_URL,
  };
}
