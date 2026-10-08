import { Languages } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { isAppLanguage, type AppLanguage } from '@/lib/i18n/languages';
import { useLanguage } from '@/shared/hooks';

import { Select } from './select';

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
      <Languages className="text-muted-foreground size-4" aria-hidden="true" />
      <Select
        id={selectId}
        size="sm"
        aria-label={t('language.label')}
        value={language}
        options={languages.map((code) => ({ value: code, label: t(LANGUAGE_LABEL_KEYS[code]) }))}
        onChange={(event) => {
          if (isAppLanguage(event.target.value)) setLanguage(event.target.value);
        }}
        className="w-auto"
      />
    </div>
  );
}
