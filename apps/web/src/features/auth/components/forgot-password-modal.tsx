import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ChangeEvent, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { useForgotPassword } from '@/features/auth/api/use-forgot-password';
import { useResetPassword } from '@/features/auth/api/use-reset-password';
import { Button, Input, useToast } from '@/shared/ui';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalStep = 'email' | 'otp' | 'success';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_LENGTH = 6;
const MIN_PASSWORD_LENGTH = 8;

export function ForgotPasswordModal({ isOpen, onClose, onSuccess }: ForgotPasswordModalProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState<ModalStep>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const [countdown, setCountdown] = useState(60);

  const forgotPasswordMutation = useForgotPassword();
  const resetPasswordMutation = useResetPassword();

  const resetAllState = useCallback(() => {
    setStep('email');
    setEmail('');
    setEmailError('');
    setOtp('');
    setOtpError('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError('');
    setConfirmError('');
    setCountdown(60);
  }, []);

  const handleClose = useCallback(() => {
    resetAllState();
    onClose();
  }, [onClose, resetAllState]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetAllState();
    }
  }, [isOpen, resetAllState]);

  // Countdown timer for Step 2 resend
  useEffect(() => {
    if (!isOpen || step !== 'otp' || countdown <= 0) {
      return undefined;
    }
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [isOpen, step, countdown]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  // Step 1: Request OTP for email
  const handleEmailSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      const trimmedEmail = email.trim();

      if (!trimmedEmail) {
        setEmailError('Vui lòng nhập email');
        return;
      }
      if (!EMAIL_REGEX.test(trimmedEmail)) {
        setEmailError('Email không hợp lệ');
        return;
      }

      forgotPasswordMutation.mutate(
        { email: trimmedEmail },
        {
          onSuccess: () => {
            showToast({
              type: 'success',
              message: 'Mã xác thực đã được gửi tới email của bạn.',
            });
            setStep('otp');
            setCountdown(60);
          },
          onError: (err) => {
            showToast({
              type: 'error',
              message: err.message || 'Không tìm thấy tài khoản với email này.',
            });
          },
        },
      );
    },
    [email, forgotPasswordMutation, showToast],
  );

  // Resend OTP in Step 2
  const handleResendOtp = useCallback(() => {
    if (countdown > 0 || forgotPasswordMutation.isPending) return;

    forgotPasswordMutation.mutate(
      { email: email.trim() },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            message: 'Đã gửi lại mã mới thành công.',
          });
          setCountdown(60);
          setOtp('');
        },
        onError: (err) => {
          showToast({
            type: 'error',
            message: err.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.',
          });
        },
      },
    );
  }, [countdown, email, forgotPasswordMutation, showToast]);

  // Step 2: Reset password submission
  const handleResetSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      let hasError = false;

      if (!otp.trim()) {
        setOtpError('Vui lòng nhập mã OTP');
        hasError = true;
      } else if (otp.trim().length !== OTP_LENGTH) {
        setOtpError('Mã OTP phải gồm 6 chữ số');
        hasError = true;
      }

      if (!newPassword) {
        setPasswordError('Vui lòng nhập mật khẩu mới');
        hasError = true;
      } else if (newPassword.length < MIN_PASSWORD_LENGTH) {
        setPasswordError(`Mật khẩu mới phải có ít nhất ${String(MIN_PASSWORD_LENGTH)} ký tự`);
        hasError = true;
      }

      if (!confirmPassword) {
        setConfirmError('Vui lòng xác nhận mật khẩu');
        hasError = true;
      } else if (newPassword !== confirmPassword) {
        setConfirmError('Mật khẩu xác nhận không khớp');
        hasError = true;
      }

      if (hasError || resetPasswordMutation.isPending) return;

      resetPasswordMutation.mutate(
        {
          email: email.trim(),
          otp: otp.trim(),
          newPassword,
        },
        {
          onSuccess: () => {
            showToast({
              type: 'success',
              message: 'Đặt lại mật khẩu thành công!',
            });
            onSuccess?.();
            setStep('success');
          },
          onError: (err) => {
            showToast({
              type: 'error',
              message:
                err.message || 'Đặt lại mật khẩu thất bại. Mã OTP không hợp lệ hoặc đã hết hạn.',
            });
          },
        },
      );
    },
    [confirmPassword, email, newPassword, onSuccess, otp, resetPasswordMutation, showToast],
  );

  const handleLoginNavigate = useCallback(() => {
    handleClose();
    void navigate('/login');
  }, [handleClose, navigate]);

  if (!isOpen) return null;

  return (
    <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* Click outside backdrop */}
      <button
        type="button"
        aria-label="Đóng modal"
        className="fixed inset-0 cursor-default"
        onClick={handleClose}
        tabIndex={-1}
      />

      {/* Card container */}
      <div className="border-border bg-card relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary-light text-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <KeyRound className="h-5 w-5" />
            </div>
            <h3 className="text-foreground text-lg font-bold">Quên mật khẩu</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng"
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: Enter Email */}
        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} noValidate className="mt-4 flex flex-col gap-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Vui lòng nhập email đã đăng ký. Chúng tôi sẽ gửi mã xác thực để đặt lại mật khẩu.
            </p>

            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="text-foreground block text-xs font-semibold">
                Email
              </label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Mail className="h-4 w-4" />
                </span>
                <Input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Nhập email của bạn..."
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  error={emailError}
                  className="h-11 pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={!email.trim() || forgotPasswordMutation.isPending}
              isLoading={forgotPasswordMutation.isPending}
              className="mt-2 w-full gap-2"
            >
              <span>Gửi mã xác thực</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Step 2: Enter OTP & New Password */}
        {step === 'otp' && (
          <form onSubmit={handleResetSubmit} className="mt-4 flex flex-col gap-4">
            {/* Alert banner */}
            <div className="flex items-start gap-2.5 rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] p-3.5 text-[#15803D]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-xs leading-relaxed sm:text-sm">
                Mã xác thực đã được gửi tới{' '}
                <strong className="font-semibold text-emerald-950">{email}</strong>
              </p>
            </div>

            {/* OTP Input */}
            <div className="space-y-1.5">
              <label htmlFor="reset-otp" className="text-foreground block text-xs font-semibold">
                Mã xác thực OTP
              </label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <KeyRound className="h-4 w-4" />
                </span>
                <Input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="Nhập 6 số OTP..."
                  value={otp}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
                    setOtp(digits);
                    if (otpError) setOtpError('');
                  }}
                  error={otpError}
                  className="h-11 pl-10 font-semibold tracking-widest"
                />
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="reset-new-password"
                className="text-foreground block text-xs font-semibold"
              >
                Mật khẩu mới
              </label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  id="reset-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Tối thiểu 8 ký tự"
                  value={newPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setNewPassword(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  error={passwordError}
                  className="h-11 pl-10 pr-10"
                />
                <button
                  type="button"
                  aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => {
                    setShowNewPassword((prev) => !prev);
                  }}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="reset-confirm-password"
                className="text-foreground block text-xs font-semibold"
              >
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  id="reset-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setConfirmPassword(e.target.value);
                    if (confirmError) setConfirmError('');
                  }}
                  error={confirmError}
                  className="h-11 pl-10 pr-10"
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  onClick={() => {
                    setShowConfirmPassword((prev) => !prev);
                  }}
                  className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Resend Cooldown Link */}
            <div className="text-muted-foreground flex items-center justify-center text-xs sm:text-sm">
              {countdown > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>
                    Chưa nhận được mã? Gửi lại sau{' '}
                    <strong className="text-foreground font-semibold">{countdown}s</strong>
                  </span>
                </span>
              ) : (
                <span>
                  Chưa nhận được mã?{' '}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={forgotPasswordMutation.isPending}
                    className="text-primary hover:text-primary-hover cursor-pointer font-semibold transition-colors disabled:opacity-50"
                  >
                    {forgotPasswordMutation.isPending ? 'Đang gửi...' : 'Gửi lại mã'}
                  </button>
                </span>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              disabled={
                otp.length !== OTP_LENGTH ||
                !newPassword ||
                newPassword.length < MIN_PASSWORD_LENGTH ||
                newPassword !== confirmPassword ||
                resetPasswordMutation.isPending
              }
              isLoading={resetPasswordMutation.isPending}
              className="mt-2 w-full gap-2"
            >
              <span>Đặt lại mật khẩu</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div className="mt-4 flex flex-col items-center py-4 text-center">
            <div className="bg-primary-light text-primary flex h-16 w-16 items-center justify-center rounded-full">
              <CheckCircle2 className="text-primary h-10 w-10" />
            </div>
            <h4 className="text-foreground mt-4 text-lg font-bold">Đặt lại mật khẩu thành công!</h4>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
              Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập bằng mật khẩu mới.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleLoginNavigate}
              className="mt-6 w-full"
            >
              Đăng nhập ngay
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
