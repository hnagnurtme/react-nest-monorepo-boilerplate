export { AUTH_ENDPOINTS } from './endpoints';
export {
  ForgotPasswordModal,
  type ForgotPasswordModalProps,
} from './components/forgot-password-modal';
export { LoginForm } from './components/login-form';
export { LoginPage } from './pages/login-page';
export {
  AbilityProvider,
  abilityKeys,
  useAbility,
  useAbilityLoading,
} from './ability/ability-context';
export { CanAction, type CanActionProps } from './ability/can-action';

export { useInitAuthSession } from './api/use-init-auth-session';
export { useLogin } from './api/use-login';
export { useForgotPassword } from './api/use-forgot-password';
export { useResetPassword } from './api/use-reset-password';
export { useChangePassword } from './api/use-change-password';

export { createLoginSchema } from './schemas/login.schema';
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
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AuthResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  ChangePasswordResponse,
  LoginFormValues,
  ForgotPasswordFormValues,
  ResetPasswordFormValues,
  ChangePasswordFormValues,
} from './types';
