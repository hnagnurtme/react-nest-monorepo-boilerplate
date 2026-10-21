import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { TENANT_ENDPOINTS } from '@/features/tenants/endpoints';
import type { LogoUpload } from '@/features/tenants/types';
import { rawRequest, type ApiError } from '@/lib/http/client';
import { apiPath } from '@/lib/http/path';
import { putSignedUpload } from '@/lib/http/upload';

export interface UploadTenantLogoInput {
  tenantId: string;
  file: File;
}

/**
 * Uploads a logo in the two steps the API expects: ask it to sign a PUT, then
 * send the file straight to the bucket.
 *
 * The file never passes through the API. The returned key is what the caller
 * then sends as `detail.logoObjectKey`; until it does, the object is uploaded
 * but unreferenced, which is why the two steps are separate mutations rather
 * than one.
 */
export function useUploadTenantLogo(): UseMutationResult<string, ApiError, UploadTenantLogoInput> {
  return useMutation<string, ApiError, UploadTenantLogoInput>({
    mutationFn: async ({ tenantId, file }) => {
      const signed = await rawRequest<LogoUpload>(
        apiPath(TENANT_ENDPOINTS.LOGO_UPLOAD_URL, { id: tenantId }),
        { method: 'POST', body: JSON.stringify({ contentType: file.type }) },
      );

      await putSignedUpload(signed.url, file, signed.contentType);

      return signed.objectKey;
    },
  });
}
