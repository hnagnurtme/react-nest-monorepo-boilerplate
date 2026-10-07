import { z } from 'zod';

import type { RegisterFormValues } from '@/features/auth/types';

export const PHONE_REGEX = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;

export function createRegisterSchema(t?: (key: string) => string): z.ZodType<RegisterFormValues> {
  const getMessage = (key: string, fallback: string): string => (t ? t(key) : fallback);

  return z.object({
    fullName: z
      .string()
      .trim()
      .min(1, getMessage('validation.fullNameRequired', 'Vui lòng nhập họ và tên'))
      .min(2, getMessage('validation.fullNameMin', 'Họ và tên phải có ít nhất 2 ký tự')),
    email: z
      .string()
      .trim()
      .min(1, getMessage('validation.emailRequired', 'Vui lòng nhập địa chỉ email'))
      .email(getMessage('validation.emailInvalid', 'Địa chỉ email không hợp lệ')),
    phoneNumber: z
      .string()
      .trim()
      .optional()
      .refine(
        (val) => !val || PHONE_REGEX.test(val),
        getMessage('validation.phoneInvalid', 'Số điện thoại không hợp lệ'),
      ),
    password: z
      .string()
      .min(1, getMessage('validation.passwordRequired', 'Vui lòng nhập mật khẩu'))
      .min(8, getMessage('validation.passwordMin', 'Mật khẩu phải có ít nhất 8 ký tự')),
    agreeTerms: z
      .boolean()
      .refine(
        (val) => val,
        getMessage('validation.agreeTermsRequired', 'Bạn phải đồng ý với Điều khoản và Chính sách'),
      ),
  });
}

export const registerSchema = createRegisterSchema();
