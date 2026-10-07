import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import type { RegisterDto, RegisterResponse } from '@/features/auth/types';
import { apiClient, type ApiError } from '@/lib/http/client';

export function useRegister(
  options?: Omit<UseMutationOptions<RegisterResponse, ApiError, RegisterDto>, 'mutationFn'>,
): UseMutationResult<RegisterResponse, ApiError, RegisterDto> {
  return useMutation<RegisterResponse, ApiError, RegisterDto>({
    mutationFn: (data: RegisterDto) => apiClient.post(AUTH_ENDPOINTS.REGISTER, data),
    ...options,
  });
}
