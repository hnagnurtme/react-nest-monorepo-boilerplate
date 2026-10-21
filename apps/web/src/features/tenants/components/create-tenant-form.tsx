import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useCreateTenant } from '@/features/tenants/api/use-create-tenant';
import { useUpdateTenant } from '@/features/tenants/api/use-update-tenant';
import { useUploadTenantLogo } from '@/features/tenants/api/use-upload-tenant-logo';
import {
  createTenantSchema,
  LOGO_CONTENT_TYPES,
  type CreateTenantFormValues,
} from '@/features/tenants/schemas/create-tenant.schema';
import { useApiErrorMessage } from '@/shared/hooks';
import { Button, ImageField, Input, PanelForm, useToast, type PanelFormVariant } from '@/shared/ui';

import { TenantAddressFields } from './tenant-address-fields';

const CONFLICT_STATUS = 409;
/** Matches `S3_MAX_UPLOAD_BYTES`; the API checks it again on the stored object. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export interface CreateTenantFormProps {
  onCreated?: () => void;
  onCancel?: () => void;
  /**
   * `panel` is the form inside a flush `SidePanel`, which draws the title and
   * the explanation itself; `card` is the standalone block on a page.
   */
  variant?: PanelFormVariant;
}

/**
 * Creating a tenant, for a platform administrator.
 *
 * An absent slug is sent as an absent field rather than an empty string: the API
 * derives it from the name, and `slug: ''` would fail validation instead.
 *
 * The logo cannot travel with the create: a signed upload key is built from the
 * tenant id, which does not exist until the tenant does. So the form creates,
 * uploads, then patches the key in. A failure at the upload step leaves a real
 * tenant without a logo, which the toast says plainly — losing the tenant to
 * roll back a thumbnail would be the worse trade.
 */
export function CreateTenantForm({
  onCreated,
  onCancel,
  variant = 'panel',
}: CreateTenantFormProps) {
  const { t } = useTranslation('tenants');
  const { showToast } = useToast();
  const toMessage = useApiErrorMessage();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const uploadLogo = useUploadTenantLogo();

  const [logoFile, setLogoFile] = useState<File | null>(null);

  const schema = useMemo(() => createTenantSchema(t), [t]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTenantFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', slug: '', addressLine: '', provinceCode: '', wardCode: '' },
  });

  const provinceCode = watch('provinceCode');
  const wardCode = watch('wardCode');

  const onSubmit = (values: CreateTenantFormValues): void => {
    const detail =
      values.wardCode === ''
        ? undefined
        : {
            provinceCode: values.provinceCode,
            wardCode: values.wardCode,
            ...(values.addressLine === '' ? {} : { addressLine: values.addressLine }),
          };

    const body = {
      name: values.name,
      ...(values.slug === '' ? {} : { slug: values.slug }),
      ...(detail === undefined ? {} : { detail }),
    };

    createTenant.mutate(body, {
      onSuccess: (tenant) => {
        if (logoFile === null) {
          showToast({ type: 'success', message: t('create.success') });
          reset();
          onCreated?.();
          return;
        }

        uploadLogo.mutate(
          { tenantId: tenant.id, file: logoFile },
          {
            onSuccess: (objectKey) => {
              updateTenant.mutate(
                { id: tenant.id, body: { detail: { logoObjectKey: objectKey } } },
                {
                  onSuccess: () => {
                    showToast({ type: 'success', message: t('create.success') });
                    reset();
                    setLogoFile(null);
                    onCreated?.();
                  },
                  onError: () => {
                    // The tenant exists; only the logo is missing. Say which.
                    showToast({ type: 'error', message: t('create.logoFailed') });
                    reset();
                    setLogoFile(null);
                    onCreated?.();
                  },
                },
              );
            },
            onError: () => {
              showToast({ type: 'error', message: t('create.logoFailed') });
              reset();
              setLogoFile(null);
              onCreated?.();
            },
          },
        );
      },
      onError: (error) => {
        showToast({
          type: 'error',
          message:
            error.status === CONFLICT_STATUS
              ? t('create.duplicate')
              : toMessage(error, t('create.error')),
        });
      },
    });
  };

  const isSaving = createTenant.isPending || uploadLogo.isPending || updateTenant.isPending;

  return (
    <PanelForm
      label={t('create.title')}
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
            {t('create.submit')}
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
      <Input
        id="tenant-slug"
        label={t('create.slug')}
        placeholder={t('create.slugPlaceholder')}
        autoComplete="off"
        error={errors.slug?.message}
        {...register('slug')}
      />

      <ImageField
        label={t('create.logo')}
        file={logoFile}
        onChange={setLogoFile}
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
