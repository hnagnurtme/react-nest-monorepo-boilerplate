import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useMemo } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { useLogin } from '@/features/auth/api/use-login';
import { chooserPathFor } from '@/features/auth/hooks/use-tenant-chooser-path';
import { createLoginSchema } from '@/features/auth/schemas/login.schema';
import type { LoginFormValues } from '@/features/auth/types';
import { ApiError } from '@/lib/http/client';
import { useToast } from '@/shared/ui';

export interface UseLoginFormReturn {
  form: UseFormReturn<LoginFormValues>;
  showPassword: boolean;
  togglePasswordVisibility: () => void;
  isSubmitting: boolean;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
}

/**
 * Where to go after signing in: back to the page that sent the person to the
 * login screen, and `/` when there was none.
 *
 * The target comes from `location.state`, which `RouteGuard` sets, and never
 * from a `?next=` query param: a parameter on the URL is something anybody can
 * put in a phishing email. It also has to be an internal path — one leading
 * slash and not two, because the browser reads `//evil.com` as an absolute URL.
 */
export function safeRedirect(state: unknown): string {
  const from = readField(state, 'from');
  const pathname = readField(from, 'pathname');
  if (typeof pathname !== 'string') return '/';
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/';

  const search = readField(from, 'search');
  return typeof search === 'string' ? `${pathname}${search}` : pathname;
}

/** One field of a value the router types as `any`, narrowed rather than cast. */
function readField(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return Object.hasOwn(value, key) ? (value as Record<string, unknown>)[key] : undefined;
}

export function useLoginForm(): UseLoginFormReturn {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  /* The router types `state` as `any`; it is untrusted input either way. */
  const locationState: unknown = location.state;
  const { showToast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const schema = useMemo(() => createLoginSchema(t), [t]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useLogin();

  const handleFormSubmit = form.handleSubmit((data) => {
    loginMutation.mutate(
      { email: data.email, password: data.password },
      {
        onSuccess: ({ user }) => {
          /*
            Signing in always lands on the chooser, never straight inside the
            tenant this tab happened to be in before: the remembered choice is
            per tab and survives a sign-out, so without this the next person to
            sign in on that machine is put inside somebody else's tenant with
            nothing on screen saying which one.

            The destination is carried along rather than dropped — somebody who
            followed a link in an email is going to that page — and the chooser
            forwards to it in the same navigation as the choice.
          */
          void navigate(chooserPathFor(user.scope), {
            replace: true,
            ...(locationState === null || locationState === undefined
              ? {}
              : { state: locationState }),
          });
        },
        onError: (error) => {
          if (error instanceof ApiError) {
            if (error.invalidParams && error.invalidParams.length > 0) {
              error.invalidParams.forEach((param) => {
                if (param.name === 'email' || param.name === 'password') {
                  form.setError(param.name, { message: param.reason });
                }
              });
            } else {
              showToast({ type: 'error', message: error.message });
            }
          } else {
            showToast({ type: 'error', message: t('validation.defaultError') });
          }
        },
      },
    );
  });

  const togglePasswordVisibility = (): void => {
    setShowPassword((prev) => !prev);
  };

  return {
    form,
    showPassword,
    togglePasswordVisibility,
    isSubmitting: loginMutation.isPending,
    onSubmit: handleFormSubmit,
  };
}
