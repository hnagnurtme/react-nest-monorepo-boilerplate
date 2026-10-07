import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_ENDPOINTS } from '@/features/auth';
import { ForgotPasswordModal } from '@/features/auth/components/forgot-password-modal';
import { ToastProvider } from '@/shared/ui';

import { jsonResponse } from './fixtures/auth';

/**
 * Drives the real mutation hooks (nothing mocked but `fetch`), so the request
 * bodies the API will receive are asserted, not just the step transitions.
 */
function renderModal(ui: ReactElement) {
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

function stubAuthFetch() {
  const fetchMock = vi
    .fn<(url: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation((url) => {
      if (url.includes(AUTH_ENDPOINTS.FORGOT_PASSWORD)) {
        return Promise.resolve(jsonResponse({ data: { message: 'sent' } }));
      }
      if (url.includes(AUTH_ENDPOINTS.RESET_PASSWORD)) {
        return Promise.resolve(jsonResponse({ data: { message: 'reset' } }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function bodyOf(
  fetchMock: ReturnType<typeof stubAuthFetch>,
  endpoint: string,
): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url]) => url.includes(endpoint));
  return JSON.parse(call?.[1]?.body as string) as Record<string, unknown>;
}

describe('forgot-password flow against the real mutation hooks', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('posts the email, then the OTP and new password, and lands on the success step', async () => {
    const fetchMock = stubAuthFetch();
    const onSuccess = vi.fn();
    const user = userEvent.setup();

    renderModal(<ForgotPasswordModal isOpen onClose={vi.fn()} onSuccess={onSuccess} />);

    await user.type(screen.getByPlaceholderText('Enter your email...'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /Send verification code/ }));

    await waitFor(() => {
      expect(bodyOf(fetchMock, AUTH_ENDPOINTS.FORGOT_PASSWORD)).toEqual({
        email: 'user@example.com',
      });
    });

    const otpInput = await screen.findByPlaceholderText('Enter the 6-digit code...');
    // Non-digits are dropped, so a pasted "12 34-56" still submits a valid code.
    await user.type(otpInput, '12 34-56');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'newpassword123');
    await user.type(screen.getByPlaceholderText('Re-enter your new password'), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /Reset password/ }));

    await waitFor(() => {
      expect(bodyOf(fetchMock, AUTH_ENDPOINTS.RESET_PASSWORD)).toEqual({
        email: 'user@example.com',
        otp: '123456',
        newPassword: 'newpassword123',
      });
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole('heading', { name: 'Password reset successful!' }),
    ).toBeInTheDocument();
  });

  it('rejects a mismatched confirmation before any request is sent', async () => {
    const fetchMock = stubAuthFetch();
    const user = userEvent.setup();

    renderModal(<ForgotPasswordModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your email...'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /Send verification code/ }));

    await user.type(await screen.findByPlaceholderText('Enter the 6-digit code...'), '123456');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'newpassword123');
    await user.type(screen.getByPlaceholderText('Re-enter your new password'), 'different');
    await user.click(screen.getByRole('button', { name: /Reset password/ }));

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.includes(AUTH_ENDPOINTS.RESET_PASSWORD))).toBe(
      false,
    );
  });

  it('keeps the modal unmounted while closed', () => {
    stubAuthFetch();
    renderModal(<ForgotPasswordModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
