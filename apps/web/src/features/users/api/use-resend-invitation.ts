import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { USER_ENDPOINTS } from '@/features/users/endpoints';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';

/**
 * Mints a fresh invitation link and emails it again. The list is not
 * invalidated on purpose: nothing about the row changes until the invitee
 * actually accepts, so a refetch would only flash the table.
 */
export function useResendInvitation(): UseMutationResult<undefined, ApiError, string> {
  return useMutation<undefined, ApiError, string>({
    mutationFn: async (id): Promise<undefined> => {
      await rawRequest<undefined>(apiPath(USER_ENDPOINTS.USER_RESEND_INVITATION, { id }), {
        method: 'POST',
      });
      return undefined;
    },
  });
}
