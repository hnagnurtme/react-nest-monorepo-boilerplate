import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import type { VerifyEmailDto, VerifyEmailResponse } from '@/features/auth/types';
import { apiClient, type ApiError } from '@/lib/http/client';

export function useVerifyEmail(
  options?: Omit<UseMutationOptions<VerifyEmailResponse, ApiError, VerifyEmailDto>, 'mutationFn'>,
): UseMutationResult<VerifyEmailResponse, ApiError, VerifyEmailDto> {
  return useMutation<VerifyEmailResponse, ApiError, VerifyEmailDto>({
    mutationFn: (data: VerifyEmailDto) => apiClient.post(AUTH_ENDPOINTS.VERIFY_EMAIL, data),
    ...options,
  });
}
