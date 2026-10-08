import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { AUTH_ENDPOINTS_WITH_PARAM } from '@/features/auth/endpoints';
import type { InvitationPreview } from '@/features/auth/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export const invitationKeys = {
  preview: (token: string) => ['auth', 'invitation', token] as const,
};

/**
 * Reads the account behind an invitation link. The endpoint is public and the
 * token is only peeked at, so opening the page twice is harmless.
 */
export function useInvitationPreview(token: string): UseQueryResult<InvitationPreview, ApiError> {
  return useQuery<InvitationPreview, ApiError>({
    queryKey: invitationKeys.preview(token),
    queryFn: () =>
      rawRequest<InvitationPreview>(
        `${AUTH_ENDPOINTS_WITH_PARAM.INVITATION_PREVIEW}/${encodeURIComponent(token)}`,
      ),
    enabled: token !== '',
    // A bad or expired token will not become good on a retry.
    retry: false,
  });
}
