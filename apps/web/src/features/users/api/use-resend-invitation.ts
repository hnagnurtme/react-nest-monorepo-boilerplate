import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { USERS_ENDPOINT } from '@/features/users/api/use-users';
import { rawRequest, type ApiError } from '@/lib/http/client';

/**
 * Mints a fresh invitation link and emails it again. The list is not
 * invalidated on purpose: nothing about the row changes until the invitee
 * actually accepts, so a refetch would only flash the table.
 */
export function useResendInvitation(): UseMutationResult<undefined, ApiError, string> {
  return useMutation<undefined, ApiError, string>({
    mutationFn: async (id): Promise<undefined> => {
      await rawRequest<undefined>(`${USERS_ENDPOINT}/${encodeURIComponent(id)}/resend-invitation`, {
        method: 'POST',
      });
      return undefined;
    },
  });
}
