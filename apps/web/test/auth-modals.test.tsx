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

    expect(screen.queryByText('Forgot password')).not.toBeInTheDocument();
  });

  it('renders Step 1 (email entry) when open', () => {
    renderWithProviders(<ForgotPasswordModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Forgot password')).toBeInTheDocument();
    expect(screen.getByText(/Please enter your registered email/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send verification code/ })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked in Step 1', () => {
    const handleClose = vi.fn();
    renderWithProviders(<ForgotPasswordModal isOpen={true} onClose={handleClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('validates email format before submitting', async () => {
    renderWithProviders(<ForgotPasswordModal isOpen={true} onClose={vi.fn()} />);

    const input = screen.getByPlaceholderText('Enter your email...');
    fireEvent.change(input, { target: { value: 'invalid-email' } });
    fireEvent.click(screen.getByRole('button', { name: /Send verification code/ }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('completes the full multi-step flow from Step 1 to Step 3', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();

    renderWithProviders(
      <ForgotPasswordModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />,
    );

    // Step 1: Submit email
    const emailInput = screen.getByPlaceholderText('Enter your email...');
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send verification code/ }));

    // Step 2: Now in OTP and password step
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter the 6-digit code...')).toBeInTheDocument();
    });

    // Enter OTP, new password, confirm password
    fireEvent.change(screen.getByPlaceholderText('Enter the 6-digit code...'), {
      target: { value: '123456' },
    });
    fireEvent.change(screen.getByPlaceholderText('Minimum 8 characters'), {
      target: { value: 'newpassword123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Re-enter your new password'), {
      target: { value: 'newpassword123' },
    });

    // Submit reset password
    fireEvent.click(screen.getByRole('button', { name: /Reset password/ }));

    // Step 3: Success step
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Password reset successful!' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in now' })).toBeInTheDocument();
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });

    // Click Login now
    fireEvent.click(screen.getByRole('button', { name: 'Sign in now' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
