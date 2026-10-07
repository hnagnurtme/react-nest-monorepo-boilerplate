import { ArrowRight, CheckCircle2, Clock, ShieldCheck, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type SyntheticEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { useResendOtp } from '@/features/auth/api/use-resend-otp';
import { useVerifyEmail } from '@/features/auth/api/use-verify-email';
import { Button, useToast } from '@/shared/ui';

export interface OtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onSuccess?: () => void;
}

const OTP_LENGTH = 6;
const OTP_SLOTS = ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'] as const;

export function OtpModal({ isOpen, onClose, email, onSuccess }: OtpModalProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [resendSuccess, setResendSuccess] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const verifyEmailMutation = useVerifyEmail();
  const resendMutation = useResendOtp();

  // Reset state and focus first input on open
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    setOtp(['', '', '', '', '', '']);
    setCountdown(60);
    setResendSuccess(false);
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (!isOpen || countdown <= 0) {
      return undefined;
    }
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, [isOpen, countdown]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleChange = useCallback((index: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (!value) {
      setOtp((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    const digit = value.slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (!otp[index] && index > 0) {
          e.preventDefault();
          setOtp((prev) => {
            const next = [...prev];
            next[index - 1] = '';
            return next;
          });
          inputRefs.current[index - 1]?.focus();
        } else if (otp[index]) {
          e.preventDefault();
          setOtp((prev) => {
            const next = [...prev];
            next[index] = '';
            return next;
          });
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
      }
    },
    [otp],
  );

  const handlePaste = useCallback((e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;

    setOtp((prev) => {
      const next = [...prev];
      for (let i = 0; i < OTP_LENGTH; i++) {
        next[i] = pasted[i] ?? '';
      }
      return next;
    });

    const nextFocusIndex = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[nextFocusIndex]?.focus();
  }, []);

  const handleResend = useCallback(() => {
    if (countdown > 0 || resendMutation.isPending) return;

    resendMutation.mutate(
      { email },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            message: 'Đã gửi lại mã mới thành công.',
          });
          setResendSuccess(true);
          setCountdown(60);
          setOtp(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        },
        onError: (err) => {
          showToast({
            type: 'error',
            message: err.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại.',
          });
        },
      },
    );
  }, [countdown, email, resendMutation, showToast]);

  const handleSubmit = useCallback(
    (e: SyntheticEvent) => {
      e.preventDefault();
      const otpValue = otp.join('');
      if (otpValue.length < OTP_LENGTH || verifyEmailMutation.isPending) return;

      verifyEmailMutation.mutate(
        { email, otp: otpValue },
        {
          onSuccess: () => {
            showToast({
              type: 'success',
              message: 'Xác thực tài khoản thành công! Vui lòng đăng nhập.',
            });
            onSuccess?.();
            onClose();
            void navigate('/login');
          },
          onError: (err) => {
            showToast({
              type: 'error',
              message: err.message || 'Mã OTP không hợp lệ hoặc đã hết hạn',
            });
          },
        },
      );
    },
    [email, navigate, onClose, onSuccess, otp, showToast, verifyEmailMutation],
  );

  if (!isOpen) return null;

  const otpString = otp.join('');
  const isSubmitDisabled = otpString.length < OTP_LENGTH || verifyEmailMutation.isPending;

  return (
    <div className="backdrop-blur-xs fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {/* Click outside backdrop */}
      <button
        type="button"
        aria-label="Đóng modal"
        className="fixed inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />

      {/* Card container */}
      <div className="border-border bg-card relative z-10 w-full max-w-md rounded-2xl border p-6 shadow-2xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary-light text-primary flex h-9 w-9 items-center justify-center rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-foreground text-lg font-bold">Xác thực Email</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alert Box */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] p-3.5 text-[#15803D]">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed sm:text-sm">
            Đã gửi mã xác thực (OTP) gồm 6 số tới{' '}
            <strong className="font-semibold text-emerald-950">{email}</strong>. Vui lòng nhập mã để
            tiếp tục.
          </p>
        </div>

        {/* Resend success notification matching Figma frame [268:11882] */}
        {resendSuccess && (
          <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Đã gửi lại mã mới thành công.</span>
          </div>
        )}

        {/* Form with 6-digit OTP Inputs */}
        <form onSubmit={handleSubmit}>
          <div className="my-6 flex justify-center gap-2.5">
            {OTP_SLOTS.map((slot, index) => (
              <input
                key={slot}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={otp[index]}
                onChange={(e) => {
                  handleChange(index, e);
                }}
                onKeyDown={(e) => {
                  handleKeyDown(index, e);
                }}
                onPaste={handlePaste}
                aria-label={`Số thứ ${String(index + 1)}`}
                className="border-border bg-card focus:border-primary focus:ring-primary/20 h-14 w-12 rounded-xl border text-center text-xl font-bold outline-none transition-all focus:ring-2"
              />
            ))}
          </div>

          {/* Cooldown & Resend */}
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
                  onClick={handleResend}
                  disabled={resendMutation.isPending}
                  className="text-primary hover:text-primary-hover cursor-pointer font-semibold transition-colors disabled:opacity-50"
                >
                  {resendMutation.isPending ? 'Đang gửi...' : 'Gửi lại mã'}
                </button>
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="border-border mt-6 flex items-center justify-end gap-3 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={verifyEmailMutation.isPending}
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitDisabled}
              isLoading={verifyEmailMutation.isPending}
              className="gap-2"
            >
              <span>Xác nhận</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
