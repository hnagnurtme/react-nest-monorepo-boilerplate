import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { usersKeys } from '@/features/users/api/use-users';
import type {
  InviteToTenantBody,
  TenantInvitationPreview,
  TenantInvitationSummary,
} from '@/features/users/types';
import { rawRequest, type ApiError } from '@/lib/http/client';

export const TENANT_INVITATIONS_ENDPOINT = '/api/v1/tenant-invitations';

export const tenantInvitationKeys = {
  all: ['tenant-invitations'] as const,
  pending: () => ['tenant-invitations', 'pending'] as const,
  preview: (token: string) => ['tenant-invitations', 'token', token] as const,
};

/**
 * Invites an account that already exists into the tenant.
 *
 * The users list is not invalidated: nothing changes until the invitee accepts,
 * so a refetch would only flash the table.
 */
export function useInviteToTenant(): UseMutationResult<undefined, ApiError, InviteToTenantBody> {
  const queryClient = useQueryClient();

  return useMutation<undefined, ApiError, InviteToTenantBody>({
    mutationFn: async (body): Promise<undefined> => {
      await rawRequest<undefined>(TENANT_INVITATIONS_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tenantInvitationKeys.all });
    },
  });
}

/** Invitations still waiting on their invitee, so an admin can chase or withdraw them. */
export function usePendingInvitations(
  options: { enabled?: boolean } = {},
): UseQueryResult<TenantInvitationSummary[], ApiError> {
  return useQuery<TenantInvitationSummary[], ApiError>({
    queryKey: tenantInvitationKeys.pending(),
    queryFn: () => rawRequest<TenantInvitationSummary[]>(TENANT_INVITATIONS_ENDPOINT),
    enabled: options.enabled ?? true,
  });
}

export function useRevokeInvitation(): UseMutationResult<undefined, ApiError, string> {
  const queryClient = useQueryClient();

  return useMutation<undefined, ApiError, string>({
    mutationFn: async (id): Promise<undefined> => {
      await rawRequest<undefined>(`${TENANT_INVITATIONS_ENDPOINT}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tenantInvitationKeys.all });
    },
  });
}

/**
 * Mints a fresh link and emails it again. The list is not invalidated: the row
 * stays pending, only its expiry moves.
 */
export function useResendInvitationToTenant(): UseMutationResult<undefined, ApiError, string> {
  return useMutation<undefined, ApiError, string>({
    mutationFn: async (id): Promise<undefined> => {
      await rawRequest<undefined>(
        `${TENANT_INVITATIONS_ENDPOINT}/${encodeURIComponent(id)}/resend`,
        { method: 'POST' },
      );
      return undefined;
    },
  });
}

/** Public: the token in the emailed link is the credential. */
export function useTenantInvitationPreview(
  token: string,
): UseQueryResult<TenantInvitationPreview, ApiError> {
  return useQuery<TenantInvitationPreview, ApiError>({
    queryKey: tenantInvitationKeys.preview(token),
    queryFn: () =>
      rawRequest<TenantInvitationPreview>(
        `${TENANT_INVITATIONS_ENDPOINT}/token/${encodeURIComponent(token)}`,
      ),
    enabled: token !== '',
    // A bad or spent token will not become good on a retry.
    retry: false,
  });
}

export function useAcceptTenantInvitation(): UseMutationResult<undefined, ApiError, string> {
  const queryClient = useQueryClient();

  return useMutation<undefined, ApiError, string>({
    mutationFn: async (token): Promise<undefined> => {
      await rawRequest<undefined>(`${TENANT_INVITATIONS_ENDPOINT}/accept`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return undefined;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  });
}
