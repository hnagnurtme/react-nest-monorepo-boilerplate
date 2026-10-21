import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useUpdateTenant } from '@/features/tenants/api/use-update-tenant';
import { useUploadTenantLogo } from '@/features/tenants/api/use-upload-tenant-logo';
import { LOGO_CONTENT_TYPES } from '@/features/tenants/schemas/create-tenant.schema';
import {
  editTenantSchema,
  type EditTenantFormValues,
} from '@/features/tenants/schemas/edit-tenant.schema';
import type { Tenant, UpdateTenantBody } from '@/features/tenants/types';
import { useApiErrorMessage } from '@/shared/hooks';
import { Button, ImageField, Input, PanelForm, useToast, type PanelFormVariant } from '@/shared/ui';

import { TenantAddressFields } from './tenant-address-fields';

/** Matches `S3_MAX_UPLOAD_BYTES`; the API checks it again on the stored object. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export interface EditTenantFormProps {
  tenant: Tenant;
  onSaved?: () => void;
  onCancel?: () => void;
  variant?: PanelFormVariant;
}

/**
 * Editing a tenant's name, logo and address.
 *
 * Unlike the create form this is one PATCH: the tenant already has an id, so
 * the logo can be uploaded first and the key travels with everything else. A
 * failed upload therefore saves nothing, which is the right trade here — there
 * is no half-made tenant to strand.
 *
 * A `detail` block is sent only when something in it actually changed. Sending
 * the unchanged values would be harmless but would write an audit entry saying
 * an address was set when nobody touched it.
 */
export function EditTenantForm({
  tenant,
  onSaved,
  onCancel,
  variant = 'panel',
}: EditTenantFormProps) {
  const { t } = useTranslation('tenants');
  const { showToast } = useToast();
  const toMessage = useApiErrorMessage();
  const updateTenant = useUpdateTenant();
  const uploadLogo = useUploadTenantLogo();

  const [logoFile, setLogoFile] = useState<File | null>(null);

  const schema = useMemo(() => editTenantSchema(t), [t]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditTenantFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: tenant.name,
      addressLine: tenant.detail?.addressLine ?? '',
      provinceCode: tenant.detail?.provinceCode ?? '',
      wardCode: tenant.detail?.wardCode ?? '',
    },
  });

  const provinceCode = watch('provinceCode');
  const wardCode = watch('wardCode');

  const save = (body: UpdateTenantBody): void => {
    updateTenant.mutate(
      { id: tenant.id, body },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: t('edit.success') });
          setLogoFile(null);
          onSaved?.();
        },
        onError: (error) => {
          showToast({ type: 'error', message: toMessage(error, t('edit.error')) });
        },
      },
    );
  };

  const onSubmit = (values: EditTenantFormValues): void => {
    const current = tenant.detail;
    const addressChanged =
      values.addressLine !== (current?.addressLine ?? '') ||
      values.wardCode !== (current?.wardCode ?? '') ||
      values.provinceCode !== (current?.provinceCode ?? '');

    // `null` is how the API is told to clear a field, which is different from
    // leaving it out — that means "do not touch it".
    const address =
      values.wardCode === ''
        ? { wardCode: null, provinceCode: null, addressLine: null }
        : {
            wardCode: values.wardCode,
            provinceCode: values.provinceCode,
            addressLine: values.addressLine === '' ? null : values.addressLine,
          };

    const base: UpdateTenantBody = {
      ...(values.name === tenant.name ? {} : { name: values.name }),
      ...(addressChanged ? { detail: address } : {}),
    };

    if (logoFile === null) {
      // Nothing to send: the API rejects an empty patch, and so should the form.
      if (Object.keys(base).length === 0) {
        onSaved?.();
        return;
      }
      save(base);
      return;
    }

    uploadLogo.mutate(
      { tenantId: tenant.id, file: logoFile },
      {
        onSuccess: (objectKey) => {
          save({
            ...base,
            detail: { ...(addressChanged ? address : {}), logoObjectKey: objectKey },
          });
        },
        onError: () => {
          showToast({ type: 'error', message: t('edit.logoFailed') });
        },
      },
    );
  };

  const isSaving = uploadLogo.isPending || updateTenant.isPending;

  return (
    <PanelForm
      label={t('edit.title')}
      variant={variant}
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      actions={
        <>
          {onCancel === undefined ? null : (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('create.cancel')}
            </Button>
          )}
          <Button type="submit" isLoading={isSaving}>
            {t('edit.submit')}
          </Button>
        </>
      }
    >
      <Input
        id="tenant-name"
        label={t('create.name')}
        autoComplete="off"
        error={errors.name?.message}
        {...register('name')}
      />

      <ImageField
        label={t('create.logo')}
        file={logoFile}
        onChange={setLogoFile}
        currentUrl={tenant.detail?.logoUrl ?? null}
        accept={LOGO_CONTENT_TYPES}
        maxBytes={MAX_LOGO_BYTES}
      />

      <TenantAddressFields
        register={register}
        errors={errors}
        provinceCode={provinceCode}
        wardCode={wardCode}
        onProvinceChange={(code) => {
          setValue('provinceCode', code);
          setValue('wardCode', '');
        }}
        onWardChange={(code) => {
          setValue('wardCode', code);
        }}
      />
    </PanelForm>
  );
}
