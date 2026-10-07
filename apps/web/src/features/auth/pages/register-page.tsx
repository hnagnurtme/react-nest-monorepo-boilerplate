import { useState } from 'react';

import { AuthHeader } from '@/features/auth/components/auth-header';
import { LoginHeroBanner } from '@/features/auth/components/login-hero-banner';
import { OtpModal } from '@/features/auth/components/otp-modal';
import { RegisterForm } from '@/features/auth/components/register-form';

export function RegisterPage() {
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  return (
    <div className="bg-card text-foreground selection:bg-primary-light selection:text-primary flex h-dvh flex-col overflow-hidden">
      {/* 1. Phần thân trên: Split Screen 2 Cột phủ toàn màn hình */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Cột trái: Header + Form Đăng ký */}
        <div className="flex min-h-0 flex-col justify-between overflow-y-auto px-6 py-6 sm:px-10 lg:px-14">
          <AuthHeader />

          <main className="my-auto flex flex-1 items-center justify-center py-6">
            <RegisterForm
              onRegisterSuccess={(email) => {
                setRegisteredEmail(email);
                setIsOtpModalOpen(true);
              }}
            />
          </main>

          <div className="h-4" />
        </div>

        {/* Cột phải: banner thương hiệu */}
        <div className="hidden h-full w-full overflow-hidden lg:block">
          <LoginHeroBanner />
        </div>
      </div>

      {/* 2. Modal Xác thực OTP */}
      <OtpModal
        isOpen={isOtpModalOpen}
        email={registeredEmail}
        onClose={() => {
          setIsOtpModalOpen(false);
        }}
      />
    </div>
  );
}
