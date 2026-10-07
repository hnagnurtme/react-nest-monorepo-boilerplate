import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import type { ForgotPasswordDto, ForgotPasswordResponse } from '@/features/auth/types';
import { apiClient, type ApiError } from '@/lib/http/client';

export function useForgotPassword(
  options?: Omit<
    UseMutationOptions<ForgotPasswordResponse, ApiError, ForgotPasswordDto>,
    'mutationFn'
  >,
): UseMutationResult<ForgotPasswordResponse, ApiError, ForgotPasswordDto> {
  return useMutation<ForgotPasswordResponse, ApiError, ForgotPasswordDto>({
    mutationFn: (data: ForgotPasswordDto) => apiClient.post(AUTH_ENDPOINTS.FORGOT_PASSWORD, data),
    ...options,
  });
}
