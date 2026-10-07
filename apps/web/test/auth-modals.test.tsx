import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ForgotPasswordModal } from '@/features/auth/components/forgot-password-modal';
import { ToastProvider } from '@/shared/ui';

const mockForgotPasswordMutate = vi.fn();
const mockResetPasswordMutate = vi.fn();

vi.mock('@/features/auth/api/use-forgot-password', () => ({
  useForgotPassword: () => ({
    mutate: mockForgotPasswordMutate,
    isPending: false,
  }),
}));

vi.mock('@/features/auth/api/use-reset-password', () => ({
  useResetPassword: () => ({
    mutate: mockResetPasswordMutate,
    isPending: false,
  }),
}));

function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ForgotPasswordModal', () => {
  beforeEach(() => {
    mockForgotPasswordMutate.mockReset();
    mockResetPasswordMutate.mockReset();

    mockForgotPasswordMutate.mockImplementation((_data, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
    mockResetPasswordMutate.mockImplementation((_data, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.();
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render when isOpen is false', () => {
    renderWithProviders(<ForgotPasswordModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByText('Quên mật khẩu')).not.toBeInTheDocument();
  });

  it('renders Step 1 (email entry) when open', () => {
    renderWithProviders(<ForgotPasswordModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Quên mật khẩu')).toBeInTheDocument();
    expect(screen.getByText(/Vui lòng nhập email đã đăng ký/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nhập email của bạn...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi mã xác thực/ })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked in Step 1', () => {
    const handleClose = vi.fn();
    renderWithProviders(<ForgotPasswordModal isOpen={true} onClose={handleClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('validates email format before submitting', async () => {
    renderWithProviders(<ForgotPasswordModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Nhập email của bạn...');
    fireEvent.change(input, { target: { value: 'invalid-email' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi mã xác thực/ }));

    await waitFor(() => {
      expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument();
    });
  });

  it('completes the full multi-step flow from Step 1 to Step 3', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    renderWithProviders(
      <ForgotPasswordModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />,
    );

    // Step 1: Submit email
    const emailInput = screen.getByPlaceholderText('Nhập email của bạn...');
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi mã xác thực/ }));

    // Step 2: Now in OTP and password step
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nhập 6 số OTP...')).toBeInTheDocument();
    });

    // Enter OTP, new password, confirm password
    fireEvent.change(screen.getByPlaceholderText('Nhập 6 số OTP...'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tối thiểu 8 ký tự'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Nhập lại mật khẩu mới'), {
      target: { value: 'newpassword123' },
    });

    // Submit reset password
    fireEvent.click(screen.getByRole('button', { name: /Đặt lại mật khẩu/ }));

    // Step 3: Success step
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Đặt lại mật khẩu thành công!' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Đăng nhập ngay' })).toBeInTheDocument();
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });

    // Click Login now
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập ngay' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
