import { useMemo } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useProvinces, useWards } from '@/features/tenants/api/use-administrative-units';
import { Input, Select } from '@/shared/ui';

/** The address half of a tenant form, shared by the create and edit panels. */
export interface TenantAddressValues {
  addressLine: string;
  provinceCode: string;
  wardCode: string;
}

export interface TenantAddressFieldsProps<T extends TenantAddressValues> {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  provinceCode: string;
  wardCode: string;
  /** Clears the ward too: a ward belongs to exactly one province. */
  onProvinceChange: (code: string) => void;
  onWardChange: (code: string) => void;
}

/**
 * Province then ward — there is no district level after the 1 July 2025 merger.
 *
 * The two selects are **controlled**, not registered, which matters when the
 * form opens with an address already set: a `<select>` whose value names an
 * option that has not arrived yet silently resets itself to empty, and the edit
 * panel would then show a blank province for a tenant that has one. Driving
 * `value` from form state means the choice reappears the moment its option does.
 *
 * The lists come from `GET /administrative-units`, reference data the migration
 * fills, so both queries cache for the life of the tab.
 */
export function TenantAddressFields<T extends TenantAddressValues>({
  register,
  errors,
  provinceCode,
  wardCode,
  onProvinceChange,
  onWardChange,
}: TenantAddressFieldsProps<T>) {
  const { t } = useTranslation('tenants');
  const provinces = useProvinces();
  const wards = useWards(provinceCode === '' ? null : provinceCode);

  const provinceOptions = useMemo(
    () => (provinces.data ?? []).map((unit) => ({ value: unit.code, label: unit.name })),
    [provinces.data],
  );
  const wardOptions = useMemo(
    () => (wards.data ?? []).map((unit) => ({ value: unit.code, label: unit.name })),
    [wards.data],
  );

  /* The generic form type defeats dot-path inference; the keys are literal. */
  const fieldErrors = errors as FieldErrors<TenantAddressValues>;

  return (
    <>
      <Select
        id="tenant-province"
        label={t('create.province')}
        placeholder={provinces.isPending ? t('create.loadingUnits') : t('create.provinceAny')}
        options={provinceOptions}
        value={provinceCode}
        error={fieldErrors.provinceCode?.message}
        onChange={(event) => {
          onProvinceChange(event.target.value);
        }}
      />
      <Select
        id="tenant-ward"
        label={t('create.ward')}
        placeholder={wards.isPending && provinceCode !== '' ? t('create.loadingUnits') : ''}
        options={wardOptions}
        value={wardCode}
        disabled={provinceCode === ''}
        error={fieldErrors.wardCode?.message}
        onChange={(event) => {
          onWardChange(event.target.value);
        }}
      />
      <Input
        id="tenant-address"
        label={t('create.addressLine')}
        placeholder={t('create.addressPlaceholder')}
        autoComplete="off"
        error={fieldErrors.addressLine?.message}
        {...register('addressLine' as never)}
      />
    </>
  );
}
