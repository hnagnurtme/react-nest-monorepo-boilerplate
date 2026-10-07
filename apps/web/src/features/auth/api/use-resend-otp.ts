import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import type { ResendOtpDto, ResendOtpResponse } from '@/features/auth/types';
import { apiClient, type ApiError } from '@/lib/http/client';

export function useResendOtp(
  options?: Omit<UseMutationOptions<ResendOtpResponse, ApiError, ResendOtpDto>, 'mutationFn'>,
): UseMutationResult<ResendOtpResponse, ApiError, ResendOtpDto> {
  return useMutation<ResendOtpResponse, ApiError, ResendOtpDto>({
    mutationFn: (data: ResendOtpDto) => apiClient.post(AUTH_ENDPOINTS.RESEND_OTP, data),
    ...options,
  });
}
