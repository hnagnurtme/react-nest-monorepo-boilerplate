export const SUPPORTED_LANGUAGES = ['en', 'vi'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: AppLanguage = 'en';
export const LANGUAGE_STORAGE_KEY = 'app.language';

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  if (value === null || value === undefined) return false;
  const supported: readonly string[] = SUPPORTED_LANGUAGES;
  return supported.includes(value);
}

/** Reads a stored choice if there is one; storage access throws in private mode. */
function storedLanguage(): AppLanguage | null {
  try {
    const stored = globalThis.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Matches `en-GB` to `en`, so a regional locale still finds its bundle. */
function fromNavigator(): AppLanguage | null {
  const candidates: readonly string[] =
    typeof navigator === 'undefined' ? [] : [...navigator.languages, navigator.language];
  for (const candidate of candidates) {
    const base = candidate.split('-')[0]?.toLowerCase();
    if (isAppLanguage(base)) return base;
  }
  return null;
}

/** Stored choice first, then the browser's preference, then English. */
export function detectLanguage(): AppLanguage {
  return storedLanguage() ?? fromNavigator() ?? FALLBACK_LANGUAGE;
}

export function persistLanguage(language: AppLanguage): void {
  try {
    globalThis.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Best effort: the choice still applies to this page load.
  }
}

/** Keeps <html lang> in step so screen readers and hyphenation follow the UI. */
export function applyDocumentLanguage(language: AppLanguage): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}
