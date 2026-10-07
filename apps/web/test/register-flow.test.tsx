import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '@/lib/i18n';

import { RegisterForm } from '@/features/auth/components/register-form';
import { RegisterFormHeader } from '@/features/auth/components/register-form-header';
import { RegisterPage } from '@/features/auth/pages/register-page';
import { ApiError } from '@/lib/http/client';
import { ToastProvider } from '@/shared/ui';

const mockRegisterMutate = vi.fn();
const mockVerifyEmailMutate = vi.fn();
const mockResendOtpMutate = vi.fn();

vi.mock('@/features/auth/api/use-register', () => ({
  useRegister: () => ({
    mutate: mockRegisterMutate,
    isPending: false,
  }),
}));

vi.mock('@/features/auth/api/use-verify-email', () => ({
  useVerifyEmail: () => ({
    mutate: mockVerifyEmailMutate,
    isPending: false,
  }),
}));

vi.mock('@/features/auth/api/use-resend-otp', () => ({
  useResendOtp: () => ({
    mutate: mockResendOtpMutate,
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

describe('RegisterFormHeader', () => {
  it('renders title and subtitle', () => {
    renderWithProviders(<RegisterFormHeader />);

    expect(screen.getByText('Tạo tài khoản mới')).toBeInTheDocument();
    expect(screen.getByText('Tạo tài khoản để bắt đầu sử dụng.')).toBeInTheDocument();
  });
});

describe('RegisterForm', () => {
  beforeEach(() => {
    mockRegisterMutate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders all form elements matching design [268:10583]', () => {
    renderWithProviders(<RegisterForm />);

    expect(screen.getByText('Họ và tên')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nguyễn Văn A')).toBeInTheDocument();

    expect(screen.getByText('Số điện thoại')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('09xx xxx xxx')).toBeInTheDocument();

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();

    expect(screen.getByText('Mật khẩu')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tạo mật khẩu')).toBeInTheDocument();

    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText(/Bằng việc đăng ký, tôi đồng ý với/)).toBeInTheDocument();
    expect(screen.getByText('Điều khoản')).toBeInTheDocument();
    expect(screen.getByText('Bảo mật')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Hoàn tất Đăng ký/ })).toBeInTheDocument();
    expect(screen.getByText('Hoặc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng ký bằng Google/ })).toBeInTheDocument();

    expect(screen.getByText(/Đã có tài khoản\?/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('toggles password visibility when clicking eye button', () => {
    renderWithProviders(<RegisterForm />);

    const passwordInput = screen.getByPlaceholderText('Tạo mật khẩu');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: 'Hiện mật khẩu' });
    fireEvent.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('shows validation errors when submitting empty form', async () => {
    renderWithProviders(<RegisterForm />);

    fireEvent.click(screen.getByRole('button', { name: /Hoàn tất Đăng ký/ }));

    await waitFor(() => {
      expect(screen.getByText('Vui lòng nhập họ và tên')).toBeInTheDocument();
      expect(screen.getByText('Vui lòng nhập địa chỉ email')).toBeInTheDocument();
      expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
      expect(screen.getByText('Bạn phải đồng ý với Điều khoản và Chính sách')).toBeInTheDocument();
    });

    expect(mockRegisterMutate).not.toHaveBeenCalled();
  });

  it('submits form successfully and calls onRegisterSuccess', async () => {
    const handleSuccess = vi.fn();
    mockRegisterMutate.mockImplementation(
      (_data, options?: { onSuccess?: (res: { email: string }) => void }) => {
        options?.onSuccess?.({ email: 'test@example.com' });
      },
    );

    renderWithProviders(<RegisterForm onRegisterSuccess={handleSuccess} />);

    fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByPlaceholderText('09xx xxx xxx'), {
      target: { value: '0912345678' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tạo mật khẩu'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /Hoàn tất Đăng ký/ }));

    await waitFor(() => {
      expect(mockRegisterMutate).toHaveBeenCalledWith(
        {
          fullName: 'Nguyễn Văn A',
          phoneNumber: '0912345678',
          email: 'test@example.com',
          password: 'password123',
          agreeTerms: true,
        },
        expect.any(Object),
      );
      expect(handleSuccess).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('maps invalidParams from ApiError to form field errors', async () => {
    mockRegisterMutate.mockImplementation(
      (_data, options?: { onError?: (err: unknown) => void }) => {
        options?.onError?.(
          new ApiError('Validation error', {
            status: 422,
            code: 'UNPROCESSABLE_ENTITY',
            invalidParams: [
              { name: 'email', reason: 'Email đã tồn tại trong hệ thống' },
              { name: 'phoneNumber', reason: 'Số điện thoại không đúng định dạng' },
            ],
          }),
        );
      },
    );

    renderWithProviders(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByPlaceholderText('09xx xxx xxx'), {
      target: { value: '0912345678' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tạo mật khẩu'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /Hoàn tất Đăng ký/ }));

    await waitFor(() => {
      expect(screen.getByText('Email đã tồn tại trong hệ thống')).toBeInTheDocument();
      expect(screen.getByText('Số điện thoại không đúng định dạng')).toBeInTheDocument();
    });
  });

  it('shows toast for general error (e.g., Conflict)', async () => {
    mockRegisterMutate.mockImplementation(
      (_data, options?: { onError?: (err: unknown) => void }) => {
        options?.onError?.(
          new ApiError('Tài khoản với email này đã tồn tại', {
            status: 409,
            code: 'CONFLICT',
          }),
        );
      },
    );

    renderWithProviders(<RegisterForm />);

    fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), {
      target: { value: 'Nguyễn Văn A' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tạo mật khẩu'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /Hoàn tất Đăng ký/ }));

    await waitFor(() => {
      expect(screen.getByText('Tài khoản với email này đã tồn tại')).toBeInTheDocument();
    });
  });
});

describe('RegisterPage', () => {
  beforeEach(() => {
    mockRegisterMutate.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders split-screen layout and opens OtpModal on successful registration', async () => {
    mockRegisterMutate.mockImplementation(
      (_data, options?: { onSuccess?: (res: { email: string }) => void }) => {
        options?.onSuccess?.({ email: 'newuser@example.com' });
      },
    );

    renderWithProviders(<RegisterPage />);

    expect(screen.getByText('Cần hỗ trợ?')).toBeInTheDocument();
    expect(screen.getByText('Starter App', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('Tạo tài khoản mới')).toBeInTheDocument();

    // Fill form and register
    fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), {
      target: { value: 'Trần Văn B' },
    });
    fireEvent.change(screen.getByPlaceholderText('name@example.com'), {
      target: { value: 'newuser@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Tạo mật khẩu'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /Hoàn tất Đăng ký/ }));

    // OtpModal should now be open with newuser@example.com
    await waitFor(() => {
      expect(screen.getByText('Xác thực Email')).toBeInTheDocument();
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    });
  });
});
