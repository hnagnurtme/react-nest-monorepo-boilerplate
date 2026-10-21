import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { MyTenant } from '@/features/tenants/types';
import { TypeCard, tenantInitials } from '@/shared/ui';

export interface TenantPickerListProps {
  tenants: MyTenant[];
  activeTenantId: string | null;
  onSelect: (tenantId: string) => void;
}

/**
 * The precise half of the picker: a 4:3 card per tenant, with its logo and the
 * address the map can only place to the province.
 */
export function TenantPickerList({ tenants, activeTenantId, onSelect }: TenantPickerListProps) {
  const { t } = useTranslation('tenants');

  /*
    `minmax(0,1fr)` on the phone's single column: an `auto` track is sized to
    its widest unbreakable child — a tenant's full address is one — so the list
    grew past the screen and `TypeCard`'s own `truncate` never engaged.
  */
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {tenants.map((tenant) => {
        const isActive = tenant.id === activeTenantId;
        const logoUrl = tenant.detail?.logoUrl ?? null;

        return (
          <li key={tenant.id}>
            <TypeCard
              layout="tile"
              isSelected={isActive}
              onSelect={() => {
                onSelect(tenant.id);
              }}
              title={tenant.name}
              description={tenant.detail?.fullAddress ?? t('map.noAddress')}
              icon={null}
              media={
                logoUrl === null ? (
                  <span className="text-display text-muted-foreground font-bold">
                    {tenantInitials(tenant.name)}
                  </span>
                ) : (
                  <img src={logoUrl} alt="" className="size-full object-cover" />
                )
              }
              trailing={
                isActive ? (
                  <Check className="text-primary-solid size-4" aria-hidden="true" />
                ) : undefined
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
