import { useState } from 'react';

import { AuthHeader } from '@/features/auth/components/auth-header';
import { ForgotPasswordModal } from '@/features/auth/components/forgot-password-modal';
import { LoginForm } from '@/features/auth/components/login-form';
import { LoginHeroBanner } from '@/features/auth/components/login-hero-banner';

export function LoginPage() {
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  return (
    <div className="bg-card text-foreground selection:bg-primary-light selection:text-primary flex h-dvh flex-col overflow-hidden">
      {/* 1. Split screen, two columns */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Left column: header + sign-in form */}
        <div className="flex min-h-0 flex-col justify-between overflow-y-auto px-6 py-6 sm:px-10 lg:px-14">
          {/* Header with the brand */}
          <AuthHeader />

          {/* Sign-in form, centred */}
          <main className="my-auto flex flex-1 items-center justify-center py-6">
            <LoginForm
              onForgotPassword={() => {
                setIsForgotModalOpen(true);
              }}
            />
          </main>

          {/* Bottom spacer */}
          <div className="h-4" />
        </div>

        {/* Right column: brand banner */}
        <div className="hidden h-full w-full overflow-hidden lg:block">
          <LoginHeroBanner />
        </div>
      </div>

      {/* 2. Forgot-password modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => {
          setIsForgotModalOpen(false);
        }}
      />
    </div>
  );
}
