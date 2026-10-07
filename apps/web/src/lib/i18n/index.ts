import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from '@/lib/i18n/locales/en/auth.json';
import enTenants from '@/lib/i18n/locales/en/tenants.json';
import enUsers from '@/lib/i18n/locales/en/users.json';
import viAuth from '@/lib/i18n/locales/vi/auth.json';
import viTenants from '@/lib/i18n/locales/vi/tenants.json';
import viUsers from '@/lib/i18n/locales/vi/users.json';

export const defaultNS = 'auth';

export const resources = {
  vi: {
    auth: viAuth,
    users: viUsers,
    tenants: viTenants,
  },
  en: {
    auth: enAuth,
    users: enUsers,
    tenants: enTenants,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
