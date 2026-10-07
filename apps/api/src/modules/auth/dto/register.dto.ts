import { createZodDto } from 'nestjs-zod/dto';
import { z } from 'zod';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const PHONE_REGEX = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Full name must be at least 2 characters long')
      .max(100, 'Full name must not exceed 100 characters'),
    email: z.string().email('Invalid email address').max(MAX_PASSWORD_LENGTH).toLowerCase().trim(),
    phoneNumber: z.string().regex(PHONE_REGEX, 'Invalid phone number').optional(),
    password: z
      .string()
      .min(
        MIN_PASSWORD_LENGTH,
        `Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters long`,
      )
      .max(MAX_PASSWORD_LENGTH),
    agreeTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the Terms and Policies' }),
    }),
  })
  .strict();

export class RegisterDto extends createZodDto(registerSchema) {}

export const verifyEmailSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
    otp: z
      .string()
      .length(6, 'OTP must be 6 digits')
      .regex(/^\d{6}$/, 'OTP must contain only digits'),
  })
  .strict();

export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}

export const resendOtpSchema = z
  .object({
    email: z.string().email().toLowerCase().trim(),
  })
  .strict();

export class ResendOtpDto extends createZodDto(resendOtpSchema) {}
