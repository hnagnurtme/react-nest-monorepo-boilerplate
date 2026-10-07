import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FALLBACK_LANGUAGE,
  isAppLanguage,
  persistLanguage,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from '@/lib/i18n/languages';

export interface LanguageControls {
  language: AppLanguage;
  languages: readonly AppLanguage[];
  setLanguage: (language: AppLanguage) => void;
}

/** Switches the UI language and remembers the choice for the next visit. */
export function useLanguage(): LanguageControls {
  const { i18n } = useTranslation();
  const resolved = i18n.resolvedLanguage ?? i18n.language;
  const language: AppLanguage = isAppLanguage(resolved) ? resolved : FALLBACK_LANGUAGE;

  const setLanguage = useCallback(
    (next: AppLanguage) => {
      persistLanguage(next);
      void i18n.changeLanguage(next);
    },
    [i18n],
  );

  return useMemo(
    () => ({ language, languages: SUPPORTED_LANGUAGES, setLanguage }),
    [language, setLanguage],
  );
}
