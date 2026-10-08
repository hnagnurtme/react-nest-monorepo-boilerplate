import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import { AUTH_ENDPOINTS } from '@/features/auth/endpoints';
import type { AcceptInvitationDto, AcceptInvitationResponse } from '@/features/auth/types';
import { apiClient, type ApiError } from '@/lib/http/client';

export function useAcceptInvitation(
  options?: Omit<
    UseMutationOptions<AcceptInvitationResponse, ApiError, AcceptInvitationDto>,
    'mutationFn'
  >,
): UseMutationResult<AcceptInvitationResponse, ApiError, AcceptInvitationDto> {
  return useMutation<AcceptInvitationResponse, ApiError, AcceptInvitationDto>({
    mutationFn: (data: AcceptInvitationDto) =>
      apiClient.post(AUTH_ENDPOINTS.ACCEPT_INVITATION, data),
    ...options,
  });
}
