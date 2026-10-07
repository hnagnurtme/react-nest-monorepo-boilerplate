import { useTranslation } from 'react-i18next';

import type { RoleItem } from '@/features/roles';

export interface RoleChecklistProps {
  idPrefix: string;
  roles: readonly RoleItem[];
  selected: readonly string[];
  disabled?: boolean;
  onToggle: (roleId: string) => void;
}

/** Checkbox list of assignable roles. */
export function RoleChecklist({
  idPrefix,
  roles,
  selected,
  disabled = false,
  onToggle,
}: RoleChecklistProps) {
  const { t } = useTranslation('users');

  return (
    <ul className="space-y-1.5">
      {roles.map((role) => {
        const id = `${idPrefix}-${role.id}`;
        return (
          <li key={role.id} className="flex items-center gap-2 text-sm">
            <input
              id={id}
              type="checkbox"
              className="border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer rounded"
              checked={selected.includes(role.id)}
              disabled={disabled}
              onChange={() => {
                onToggle(role.id);
              }}
            />
            <label htmlFor={id} className="cursor-pointer select-none">
              {role.name}
            </label>
            {role.isSystem ? (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                {t('create.systemBadge')}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
