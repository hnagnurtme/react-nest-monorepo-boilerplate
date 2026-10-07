import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import type { ChangePasswordDto, ChangePasswordResponse } from '@/features/auth/types';
import { apiClient, type ApiError } from '@/lib/http/client';

export function useChangePassword(
  options?: Omit<
    UseMutationOptions<ChangePasswordResponse, ApiError, ChangePasswordDto>,
    'mutationFn'
  >,
): UseMutationResult<ChangePasswordResponse, ApiError, ChangePasswordDto> {
  return useMutation<ChangePasswordResponse, ApiError, ChangePasswordDto>({
    mutationFn: (data: ChangePasswordDto) => apiClient.post(AUTH_ENDPOINTS.CHANGE_PASSWORD, data),
    ...options,
  });
}
