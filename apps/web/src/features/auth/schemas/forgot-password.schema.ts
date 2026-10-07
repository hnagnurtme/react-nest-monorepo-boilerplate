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
      .min(1, getMessage('validation.emailRequired', 'Vui lòng nhập địa chỉ email'))
      .email(getMessage('validation.emailInvalid', 'Địa chỉ email không hợp lệ')),
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
        .min(1, getMessage('validation.emailRequired', 'Vui lòng nhập địa chỉ email'))
        .email(getMessage('validation.emailInvalid', 'Địa chỉ email không hợp lệ')),
      otp: z
        .string()
        .trim()
        .min(1, getMessage('validation.otpRequired', 'Vui lòng nhập mã OTP'))
        .length(6, getMessage('validation.otpLength', 'Mã OTP phải gồm 6 chữ số'))
        .regex(OTP_REGEX, getMessage('validation.otpDigitsOnly', 'Mã OTP chỉ bao gồm chữ số')),
      newPassword: z
        .string()
        .min(1, getMessage('validation.newPasswordRequired', 'Vui lòng nhập mật khẩu mới'))
        .min(8, getMessage('validation.newPasswordMin', 'Mật khẩu mới phải có ít nhất 8 ký tự')),
      confirmPassword: z
        .string()
        .min(1, getMessage('validation.confirmPasswordRequired', 'Vui lòng xác nhận mật khẩu mới')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: getMessage('validation.passwordMismatch', 'Mật khẩu xác nhận không khớp'),
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
          getMessage('validation.currentPasswordRequired', 'Vui lòng nhập mật khẩu hiện tại'),
        ),
      newPassword: z
        .string()
        .min(1, getMessage('validation.newPasswordRequired', 'Vui lòng nhập mật khẩu mới'))
        .min(8, getMessage('validation.newPasswordMin', 'Mật khẩu mới phải có ít nhất 8 ký tự')),
      confirmPassword: z
        .string()
        .min(1, getMessage('validation.confirmPasswordRequired', 'Vui lòng xác nhận mật khẩu mới')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: getMessage('validation.passwordMismatch', 'Mật khẩu xác nhận không khớp'),
      path: ['confirmPassword'],
    });
}

export const changePasswordSchema = createChangePasswordSchema();
