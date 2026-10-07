import type { components, operations } from '@repo/api-contract';

export type LoginDto = components['schemas']['LoginDto'];
export type RegisterDto = components['schemas']['RegisterDto'];
export type VerifyEmailDto = components['schemas']['VerifyEmailDto'];
export type ResendOtpDto = components['schemas']['ResendOtpDto'];
export type ForgotPasswordDto = components['schemas']['ForgotPasswordDto'];
export type ResetPasswordDto = components['schemas']['ResetPasswordDto'];
export type ChangePasswordDto = components['schemas']['ChangePasswordDto'];

type ExtractResponseData<T> = T extends {
  content?: { 'application/json': { data: infer D } };
}
  ? D
  : never;

export type AuthResponse = ExtractResponseData<
  operations['AuthController_login_v1']['responses'][200]
>;
export type RegisterResponse = ExtractResponseData<
  operations['AuthController_register_v1']['responses'][201]
>;
export type VerifyEmailResponse = ExtractResponseData<
  operations['AuthController_verifyEmail_v1']['responses'][200]
>;
export type ResendOtpResponse = ExtractResponseData<
  operations['AuthController_resendOtp_v1']['responses'][200]
>;
export type ForgotPasswordResponse = ExtractResponseData<
  operations['AuthController_forgotPassword_v1']['responses'][200]
>;
export type ResetPasswordResponse = ExtractResponseData<
  operations['AuthController_resetPassword_v1']['responses'][200]
>;
export type ChangePasswordResponse = ExtractResponseData<
  operations['AuthController_changePassword_v1']['responses'][200]
>;

export interface LoginFormValues {
  email: string;
  password: string;
}

export interface RegisterFormValues {
  fullName: string;
  phoneNumber?: string | undefined;
  email: string;
  password: string;
  agreeTerms: boolean;
}

export interface ForgotPasswordFormValues {
  email: string;
}

export interface ResetPasswordFormValues {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
