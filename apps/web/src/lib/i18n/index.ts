import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enAuth from '@/lib/i18n/locales/en/auth.json';
import enRoles from '@/lib/i18n/locales/en/roles.json';
import enTenants from '@/lib/i18n/locales/en/tenants.json';
import enUsers from '@/lib/i18n/locales/en/users.json';
import viAuth from '@/lib/i18n/locales/vi/auth.json';
import viRoles from '@/lib/i18n/locales/vi/roles.json';
import viTenants from '@/lib/i18n/locales/vi/tenants.json';
import viUsers from '@/lib/i18n/locales/vi/users.json';

export const defaultNS = 'auth';

export const resources = {
  vi: {
    auth: viAuth,
    users: viUsers,
    tenants: viTenants,
    roles: viRoles,
  },
  en: {
    auth: enAuth,
    users: enUsers,
    tenants: enTenants,
    roles: enRoles,
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
