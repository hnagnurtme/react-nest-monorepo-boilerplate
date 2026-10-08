import { useLoginForm } from '@/features/auth/hooks/use-login-form';

import { LoginFormHeader } from './login-form-header';
import { LoginIdentityInput } from './login-identity-input';
import { LoginSubmitButton } from './login-submit-button';
import { PasswordInput } from './password-input';

interface LoginFormProps {
  onForgotPassword: () => void;
}

export function LoginForm({ onForgotPassword }: LoginFormProps) {
  const { form, showPassword, togglePasswordVisibility, isSubmitting, onSubmit } = useLoginForm();

  return (
    <div className="max-w-form mx-auto w-full space-y-6">
      <LoginFormHeader />

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <LoginIdentityInput form={form} />

        <PasswordInput
          form={form}
          showPassword={showPassword}
          togglePasswordVisibility={togglePasswordVisibility}
          onForgotPassword={onForgotPassword}
        />

        <LoginSubmitButton isSubmitting={isSubmitting} />
      </form>
    </div>
  );
}
