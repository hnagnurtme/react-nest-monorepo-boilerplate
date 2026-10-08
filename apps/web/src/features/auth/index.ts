export { AUTH_ENDPOINTS, AUTH_ENDPOINTS_WITH_PARAM } from './endpoints';
export {
  ForgotPasswordModal,
  type ForgotPasswordModalProps,
} from './components/forgot-password-modal';
export { LoginForm } from './components/login-form';
export { LoginPage } from './pages/login-page';
export { AcceptInvitationPage } from './pages/accept-invitation-page';
export { SelectTenantPage } from './pages/select-tenant-page';
export { TenantSwitcher } from './components/tenant-switcher';
export { useActiveTenant, TENANT_PARAM, type ActiveTenant } from './hooks/use-active-tenant';
export { useTenantHref } from './hooks/use-tenant-href';
export {
  AbilityProvider,
  abilityKeys,
  useAbility,
  useAbilityLoading,
} from './ability/ability-context';
export { CanAction, type CanActionProps } from './ability/can-action';

export { useInitAuthSession } from './api/use-init-auth-session';
export { useLogin } from './api/use-login';
export { useLogout } from './api/use-logout';
export { useForgotPassword } from './api/use-forgot-password';
export { useResetPassword } from './api/use-reset-password';
export { useChangePassword } from './api/use-change-password';
export { useInvitationPreview, invitationKeys } from './api/use-invitation-preview';
export { useAcceptInvitation } from './api/use-accept-invitation';
export {
  useForgotPasswordFlow,
  RESEND_COOLDOWN_SECONDS,
  type ForgotPasswordFlow,
  type ForgotPasswordStep,
} from './hooks/use-forgot-password-flow';

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
export {
  createAcceptInvitationSchema,
  acceptInvitationSchema,
} from './schemas/accept-invitation.schema';

export type {
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  AcceptInvitationDto,
  InvitationPreview,
  AcceptInvitationResponse,
  AcceptInvitationFormValues,
  AuthResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  ChangePasswordResponse,
  LoginFormValues,
  ForgotPasswordFormValues,
  ResetPasswordFormValues,
  ChangePasswordFormValues,
} from './types';
