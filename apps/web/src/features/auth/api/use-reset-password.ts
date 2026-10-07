import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import type { ResetPasswordDto, ResetPasswordResponse } from '@/features/auth/types';
import { apiClient, type ApiError } from '@/lib/http/client';

export function useResetPassword(
  options?: Omit<
    UseMutationOptions<ResetPasswordResponse, ApiError, ResetPasswordDto>,
    'mutationFn'
  >,
): UseMutationResult<ResetPasswordResponse, ApiError, ResetPasswordDto> {
  return useMutation<ResetPasswordResponse, ApiError, ResetPasswordDto>({
    mutationFn: (data: ResetPasswordDto) => apiClient.post(AUTH_ENDPOINTS.RESET_PASSWORD, data),
    ...options,
  });
}
