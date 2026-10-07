export { AUTH_ENDPOINTS } from './endpoints';
export {
  ForgotPasswordModal,
  type ForgotPasswordModalProps,
} from './components/forgot-password-modal';
export { LoginForm } from './components/login-form';
export { RegisterForm, type RegisterFormProps } from './components/register-form';
export { RegisterFormHeader } from './components/register-form-header';
export { OtpModal, type OtpModalProps } from './components/otp-modal';
export { LoginPage } from './pages/login-page';
export { RegisterPage } from './pages/register-page';
export {
  useRegisterForm,
  type UseRegisterFormOptions,
  type UseRegisterFormReturn,
} from './hooks/use-register-form';

export { AbilityProvider, useAbility } from './ability/ability-context';
export { CanAction, type CanActionProps } from './ability/can-action';

export { useInitAuthSession } from './api/use-init-auth-session';
export { useLogin } from './api/use-login';
export { useRegister } from './api/use-register';
export { useVerifyEmail } from './api/use-verify-email';
export { useResendOtp } from './api/use-resend-otp';
export { useForgotPassword } from './api/use-forgot-password';
export { useResetPassword } from './api/use-reset-password';
export { useChangePassword } from './api/use-change-password';

export { createLoginSchema } from './schemas/login.schema';
export { createRegisterSchema, registerSchema, PHONE_REGEX } from './schemas/register.schema';
export {
  createForgotPasswordSchema,
  forgotPasswordSchema,
  createResetPasswordSchema,
  resetPasswordSchema,
  createChangePasswordSchema,
  changePasswordSchema,
  OTP_REGEX,
} from './schemas/forgot-password.schema';

export type {
  LoginDto,
  RegisterDto,
  VerifyEmailDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AuthResponse,
  RegisterResponse,
  VerifyEmailResponse,
  ResendOtpResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  ChangePasswordResponse,
  LoginFormValues,
  RegisterFormValues,
  ForgotPasswordFormValues,
  ResetPasswordFormValues,
  ChangePasswordFormValues,
} from './types';
