import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
  applyDocumentLanguage,
  detectLanguage,
  FALLBACK_LANGUAGE,
  isAppLanguage,
  SUPPORTED_LANGUAGES,
} from '@/lib/i18n/languages';
import enAuth from '@/lib/i18n/locales/en/auth.json';
import enCommon from '@/lib/i18n/locales/en/common.json';
import enNav from '@/lib/i18n/locales/en/nav.json';
import enRoles from '@/lib/i18n/locales/en/roles.json';
import enTenants from '@/lib/i18n/locales/en/tenants.json';
import enUsers from '@/lib/i18n/locales/en/users.json';
import viAuth from '@/lib/i18n/locales/vi/auth.json';
import viCommon from '@/lib/i18n/locales/vi/common.json';
import viNav from '@/lib/i18n/locales/vi/nav.json';
import viRoles from '@/lib/i18n/locales/vi/roles.json';
import viTenants from '@/lib/i18n/locales/vi/tenants.json';
import viUsers from '@/lib/i18n/locales/vi/users.json';

/** Shared labels (Save, Cancel, pagination, generic API errors) live here. */
export const defaultNS = 'common';

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    nav: enNav,
    users: enUsers,
    tenants: enTenants,
    roles: enRoles,
  },
  vi: {
    common: viCommon,
    auth: viAuth,
    nav: viNav,
    users: viUsers,
    tenants: viTenants,
    roles: viRoles,
  },
} as const;

const initialLanguage = detectLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: [...SUPPORTED_LANGUAGES],
  defaultNS,
  interpolation: {
    escapeValue: false,
  },
});

applyDocumentLanguage(initialLanguage);

// <html lang> must follow every switch, including one made outside useLanguage.
i18n.on('languageChanged', (language: string) => {
  if (isAppLanguage(language)) applyDocumentLanguage(language);
});

export default i18n;
