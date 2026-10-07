import { Languages } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { isAppLanguage, type AppLanguage } from '@/lib/i18n/languages';
import { useLanguage } from '@/shared/hooks';

// Explicit keys, not a template literal, so the typed `t()` can check them.
const LANGUAGE_LABEL_KEYS = {
  en: 'language.en',
  vi: 'language.vi',
} as const satisfies Record<AppLanguage, string>;

/** Lets the user pick the UI language; the choice is remembered across visits. */
export function LanguageSwitcher() {
  const { t } = useTranslation('common');
  const { language, languages, setLanguage } = useLanguage();
  const selectId = useId();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={selectId} className="sr-only">
        {t('language.label')}
      </label>
      <Languages className="text-muted-foreground h-4 w-4" aria-hidden="true" />
      <select
        id={selectId}
        value={language}
        onChange={(event) => {
          if (isAppLanguage(event.target.value)) setLanguage(event.target.value);
        }}
        className="border-border bg-card text-foreground focus:border-primary focus:ring-primary/20 cursor-pointer rounded-xl border px-2 py-1.5 text-xs outline-none focus:ring-2"
      >
        {languages.map((code) => (
          <option key={code} value={code}>
            {t(LANGUAGE_LABEL_KEYS[code])}
          </option>
        ))}
      </select>
    </div>
  );
}
