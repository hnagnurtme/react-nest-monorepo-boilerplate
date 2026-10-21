import { useMemo } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useProvinces, useWards } from '@/features/tenants/api/use-administrative-units';
import { Combobox, Input } from '@/shared/ui';

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
 * Both are `Combobox`, not `Select`: the merger left 34 provinces and gave each
 * of them every ward of the districts it absorbed, so a ward list runs to the
 * hundreds. Scrolling one is slower than typing three letters of it, and the
 * search folds accents, so `go vap` finds `Gò Vấp`.
 *
 * The two fields are **controlled**, not registered, which matters when the
 * form opens with an address already set: a value naming an option that has not
 * arrived yet would render as blank, and the edit panel would show no province
 * for a tenant that has one. Driving `value` from form state means the choice
 * reappears the moment its option does.
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
      <Combobox
        id="tenant-province"
        label={t('create.province')}
        placeholder={provinces.isPending ? t('create.loadingUnits') : t('create.provinceAny')}
        options={provinceOptions}
        value={provinceCode}
        error={fieldErrors.provinceCode?.message}
        onChange={onProvinceChange}
      />
      {/* The ward is required only once a province is chosen: the address
          block as a whole is optional, but a province without a ward is
          rejected. */}
      <Combobox
        id="tenant-ward"
        label={t('create.ward')}
        isRequired={provinceCode !== ''}
        placeholder={wards.isPending && provinceCode !== '' ? t('create.loadingUnits') : ''}
        options={wardOptions}
        value={wardCode}
        disabled={provinceCode === ''}
        error={fieldErrors.wardCode?.message}
        onChange={onWardChange}
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
