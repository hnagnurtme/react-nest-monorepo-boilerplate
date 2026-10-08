import type { TFunction } from 'i18next';
import { z } from 'zod';

import type { AcceptInvitationFormValues } from '@/features/auth/types';

const MIN_PASSWORD_LENGTH = 8;

/** Keys shared with the reset-password schema, listed so a typo is a type error. */
type AcceptInvitationMessageKey =
  | 'validation.newPasswordRequired'
  | 'validation.newPasswordMin'
  | 'validation.confirmPasswordRequired'
  | 'validation.passwordMismatch';

/** Mirrors `createResetPasswordSchema`: usable without a translator too. */
export function createAcceptInvitationSchema(
  t?: TFunction<'auth'>,
): z.ZodType<AcceptInvitationFormValues> {
  const message = (key: AcceptInvitationMessageKey, fallback: string): string =>
    t ? t(key) : fallback;

  return z
    .object({
      password: z
        .string()
        .min(1, message('validation.newPasswordRequired', 'Please enter a new password'))
        .min(
          MIN_PASSWORD_LENGTH,
          message('validation.newPasswordMin', 'New password must be at least 8 characters'),
        ),
      confirmPassword: z
        .string()
        .min(1, message('validation.confirmPasswordRequired', 'Please confirm your new password')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: message('validation.passwordMismatch', 'Passwords do not match'),
      path: ['confirmPassword'],
    });
}

export const acceptInvitationSchema = createAcceptInvitationSchema();
