import { z } from 'zod';

import type { LoginFormValues } from '@/features/auth/types';

export function createLoginSchema(t: (key: string) => string): z.ZodType<LoginFormValues> {
  return z.object({
    email: z.string().min(1, t('validation.identityRequired')),
    password: z.string().min(1, t('validation.passwordRequired')),
  });
}
