import { useTranslation } from 'react-i18next';

import { useActiveTenant } from '@/features/auth/hooks/use-active-tenant';
import { Select } from '@/shared/ui';

/**
 * Moves the tab to another of the account's tenants. Hidden for an account with
 * nothing to switch between, so it does not advertise a choice that does not
 * exist.
 */
export function TenantSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation('auth');
  const { tenants, activeTenantId, switchTenant } = useActiveTenant();

  if (tenants.length < 2) return null;

  return (
    <Select
      className={className}
      aria-label={t('tenantSwitcher.label')}
      value={activeTenantId ?? ''}
      options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
      onChange={(event) => {
        switchTenant(event.target.value);
      }}
    />
  );
}
