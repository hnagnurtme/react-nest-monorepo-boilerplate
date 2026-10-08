import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { broadcastLogout, useAuthStore } from '@/entities/session';
import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import { apiClient, type ApiError } from '@/lib/http/client';

/**
 * Ends the session on the server as well as in this tab: the refresh token is
 * an opaque row in `sessions`, so dropping the in-memory access token alone
 * would leave a usable session behind.
 *
 * The local state is cleared whether or not the call succeeds — a network error
 * must not leave someone looking at a page they pressed "sign out" on.
 */
export function useLogout(): UseMutationResult<undefined, ApiError, undefined> {
  const queryClient = useQueryClient();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const finish = (): void => {
    clearAuth();
    broadcastLogout();
    queryClient.clear();
  };

  return useMutation<undefined, ApiError, undefined>({
    mutationFn: async () => {
      await apiClient.post(AUTH_ENDPOINTS.LOGOUT, {});
      return undefined;
    },
    onSuccess: finish,
    onError: finish,
  });
}
