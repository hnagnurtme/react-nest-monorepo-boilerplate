import { z } from 'zod';

import type {
  ChangePasswordFormValues,
  ForgotPasswordFormValues,
  ResetPasswordFormValues,
} from '@/features/auth/types';

export const OTP_REGEX = /^\d{6}$/;

export function createForgotPasswordSchema(
  t?: (key: string) => string,
): z.ZodType<ForgotPasswordFormValues> {
  const getMessage = (key: string, fallback: string): string => (t ? t(key) : fallback);

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
  t?: (key: string) => string,
): z.ZodType<ResetPasswordFormValues> {
  const getMessage = (key: string, fallback: string): string => (t ? t(key) : fallback);

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
        .min(1, getMessage('validation.newPasswordRequired', 'Vui lòng nhập mật khẩu mới'))
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
  t?: (key: string) => string,
): z.ZodType<ChangePasswordFormValues> {
  const getMessage = (key: string, fallback: string): string => (t ? t(key) : fallback);

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
        .min(1, getMessage('validation.newPasswordRequired', 'Vui lòng nhập mật khẩu mới'))
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
