import type { defaultNS, resources } from '@/lib/i18n';

/**
 * Makes `t()` keys checked at compile time: a typo, or a key that exists in one
 * namespace only, is a type error instead of a string rendered to the user.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['en'];
  }
}
