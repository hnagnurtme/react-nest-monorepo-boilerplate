import type { TFunction } from 'i18next';
import { z } from 'zod';

import type {
  ChangePasswordFormValues,
  ForgotPasswordFormValues,
  ResetPasswordFormValues,
} from '@/features/auth/types';

export const OTP_REGEX = /^\d{6}$/;

/** The validation keys these schemas use, listed so a typo is a type error. */
type AuthMessageKey =
  | 'validation.emailRequired'
  | 'validation.emailInvalid'
  | 'validation.otpRequired'
  | 'validation.otpLength'
  | 'validation.otpDigitsOnly'
  | 'validation.newPasswordRequired'
  | 'validation.newPasswordMin'
  | 'validation.currentPasswordRequired'
  | 'validation.confirmPasswordRequired'
  | 'validation.passwordMismatch';

/**
 * The schemas are also used outside React (and in tests) where no translator is
 * available, so every message has an English fallback.
 */
function messageFactory(t?: TFunction<'auth'>) {
  return (key: AuthMessageKey, fallback: string): string => (t ? t(key) : fallback);
}

export function createForgotPasswordSchema(
  t?: TFunction<'auth'>,
): z.ZodType<ForgotPasswordFormValues> {
  const getMessage = messageFactory(t);

  return z.object({
    email: z
      .string()
      .trim()
      .min(1, getMessage('validation.emailRequired', 'Please enter your email address'))
      .email(getMessage('validation.emailInvalid', 'Invalid email address')),
  });
}

export const forgotPasswordSchema = createForgotPasswordSchema();

export function createResetPasswordSchema(
  t?: TFunction<'auth'>,
): z.ZodType<ResetPasswordFormValues> {
  const getMessage = messageFactory(t);

  return z
    .object({
      email: z
        .string()
        .trim()
        .min(1, getMessage('validation.emailRequired', 'Please enter your email address'))
        .email(getMessage('validation.emailInvalid', 'Invalid email address')),
      otp: z
        .string()
        .trim()
        .min(1, getMessage('validation.otpRequired', 'Please enter the OTP code'))
        .length(6, getMessage('validation.otpLength', 'OTP code must be 6 digits'))
        .regex(
          OTP_REGEX,
          getMessage('validation.otpDigitsOnly', 'OTP code must contain only digits'),
        ),
      newPassword: z
        .string()
        .min(1, getMessage('validation.newPasswordRequired', 'Please enter a new password'))
        .min(
          8,
          getMessage('validation.newPasswordMin', 'New password must be at least 8 characters'),
        ),
      confirmPassword: z
        .string()
        .min(
          1,
          getMessage('validation.confirmPasswordRequired', 'Please confirm your new password'),
        ),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: getMessage('validation.passwordMismatch', 'Passwords do not match'),
      path: ['confirmPassword'],
    });
}

export const resetPasswordSchema = createResetPasswordSchema();

export function createChangePasswordSchema(
  t?: TFunction<'auth'>,
): z.ZodType<ChangePasswordFormValues> {
  const getMessage = messageFactory(t);

  return z
    .object({
      currentPassword: z
        .string()
        .min(
          1,
          getMessage('validation.currentPasswordRequired', 'Please enter your current password'),
        ),
      newPassword: z
        .string()
        .min(1, getMessage('validation.newPasswordRequired', 'Please enter a new password'))
        .min(
          8,
          getMessage('validation.newPasswordMin', 'New password must be at least 8 characters'),
        ),
      confirmPassword: z
        .string()
        .min(
          1,
          getMessage('validation.confirmPasswordRequired', 'Please confirm your new password'),
        ),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: getMessage('validation.passwordMismatch', 'Passwords do not match'),
      path: ['confirmPassword'],
    });
}

export const changePasswordSchema = createChangePasswordSchema();
