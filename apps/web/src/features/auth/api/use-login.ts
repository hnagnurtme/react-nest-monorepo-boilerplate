import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { useAuthStore } from '@/entities/session';
import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import type { AuthResponse, LoginDto } from '@/features/auth/types';
import { apiClient, type ApiError } from '@/lib/http/client';

export function useLogin(): UseMutationResult<AuthResponse, ApiError, LoginDto> {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation<AuthResponse, ApiError, LoginDto>({
    mutationFn: (credentials: LoginDto) => apiClient.post(AUTH_ENDPOINTS.LOGIN, credentials),
    onSuccess: ({ accessToken, user }) => {
      setAuth(accessToken, user);
    },
  });
}
