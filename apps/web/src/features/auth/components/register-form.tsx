import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { RegisterFormHeader } from '@/features/auth/components/register-form-header';
import { useRegisterForm } from '@/features/auth/hooks/use-register-form';
import { GoogleIcon } from '@/shared/icons';
import { Button, CheckboxField, DividerLabel, Input } from '@/shared/ui';

export interface RegisterFormProps {
  onRegisterSuccess?: ((email: string) => void) | undefined;
}

export function RegisterForm({ onRegisterSuccess }: RegisterFormProps) {
  const { t } = useTranslation('auth');
  const { form, showPassword, togglePasswordVisibility, isSubmitting, onSubmit } = useRegisterForm({
    onRegisterSuccess,
  });

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-6">
      <RegisterFormHeader />

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        {/* Field fullName */}
        <div className="space-y-1.5">
          <label htmlFor="register-fullName" className="text-foreground text-sm font-medium">
            {t('register.fullNameLabel')}
          </label>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute left-0 top-0 flex h-11 items-center pl-3">
              <User className="h-4 w-4" />
            </span>
            <Input
              id="register-fullName"
              {...register('fullName')}
              type="text"
              autoComplete="name"
              placeholder={t('register.fullNamePlaceholder')}
              error={errors.fullName?.message}
              className="h-11 rounded-xl pl-10"
            />
          </div>
        </div>

        {/* Row with 2-column grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Field phoneNumber */}
          <div className="space-y-1.5">
            <label htmlFor="register-phoneNumber" className="text-foreground text-sm font-medium">
              {t('register.phoneLabel')}
            </label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute left-0 top-0 flex h-11 items-center pl-3">
                <Phone className="h-4 w-4" />
              </span>
              <Input
                id="register-phoneNumber"
                {...register('phoneNumber')}
                type="tel"
                autoComplete="tel"
                placeholder="09xx xxx xxx"
                error={errors.phoneNumber?.message}
                className="h-11 rounded-xl pl-10"
              />
            </div>
          </div>

          {/* Field email */}
          <div className="space-y-1.5">
            <label htmlFor="register-email" className="text-foreground text-sm font-medium">
              {t('register.emailLabel')}
            </label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute left-0 top-0 flex h-11 items-center pl-3">
                <Mail className="h-4 w-4" />
              </span>
              <Input
                id="register-email"
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder={t('register.emailPlaceholder')}
                error={errors.email?.message}
                className="h-11 rounded-xl pl-10"
              />
            </div>
          </div>
        </div>

        {/* Field password */}
        <div className="space-y-1.5">
          <label htmlFor="register-password" className="text-foreground text-sm font-medium">
            {t('register.passwordLabel')}
          </label>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute left-0 top-0 flex h-11 items-center pl-3">
              <Lock className="h-4 w-4" />
            </span>
            <Input
              id="register-password"
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder={t('register.passwordPlaceholder')}
              error={errors.password?.message}
              className="h-11 rounded-xl pl-10 pr-10"
            />
            <button
              type="button"
              aria-label={showPassword ? t('form.hidePassword') : t('form.showPassword')}
              onClick={togglePasswordVisibility}
              className="text-muted-foreground hover:text-foreground absolute right-0 top-0 flex h-11 cursor-pointer items-center pr-3"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Checkbox agreeTerms */}
        <CheckboxField
          id="register-agree-terms"
          {...register('agreeTerms')}
          error={errors.agreeTerms?.message}
          label={
            <span>
              {t('register.agreeTermsPrefix')}
              <Link
                to="/terms"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="text-primary font-medium hover:underline"
              >
                {t('register.termsLink')}
              </Link>
              {t('register.andWord')}
              <Link
                to="/privacy"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="text-primary font-medium hover:underline"
              >
                {t('register.privacyLink')}
              </Link>
              {t('register.agreeTermsSuffix')}
            </span>
          }
        />

        {/* Submit Button */}
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          className="bg-primary hover:bg-primary-hover text-primary-foreground flex h-11 w-full items-center justify-center gap-2 rounded-xl font-semibold"
        >
          {isSubmitting ? (
            <span>{t('register.submitting')}</span>
          ) : (
            <>
              <span>{t('register.submit')}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Divider */}
      <DividerLabel label={t('register.orDivider')} />

      {/* Google Auth Button */}
      <Button
        type="button"
        variant="secondary"
        className="border-border h-11 w-full gap-2 rounded-xl border"
      >
        <GoogleIcon className="h-4 w-4" />
        <span>{t('register.googleAuth')}</span>
      </Button>

      {/* Bottom Link */}
      <p className="text-muted-foreground text-center text-sm">
        {t('register.hasAccountPrompt')}
        <Link
          to="/login"
          className="text-primary hover:text-primary-hover font-semibold transition-colors"
        >
          {t('register.loginAction')}
        </Link>
      </p>
    </div>
  );
}
