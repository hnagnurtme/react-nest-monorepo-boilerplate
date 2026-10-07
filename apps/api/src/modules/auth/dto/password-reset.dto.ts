import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

export const forgotPasswordSchema = z
  .object({
    email: z.string().email('Địa chỉ email không hợp lệ').toLowerCase().trim(),
  })
  .strict();

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export const resetPasswordSchema = z
  .object({
    email: z.string().email('Địa chỉ email không hợp lệ').toLowerCase().trim(),
    otp: z
      .string()
      .length(6, 'Mã OTP gồm 6 chữ số')
      .regex(/^\d{6}$/, 'Mã OTP chỉ bao gồm chữ số'),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Mật khẩu phải có ít nhất ${String(MIN_PASSWORD_LENGTH)} ký tự`)
      .max(MAX_PASSWORD_LENGTH),
  })
  .strict();

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, `Mật khẩu mới phải có ít nhất ${String(MIN_PASSWORD_LENGTH)} ký tự`)
      .max(MAX_PASSWORD_LENGTH),
  })
  .strict();

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
