import { useTranslation } from 'react-i18next';

import type { RoleItem } from '@/features/roles';
import { Badge, CheckboxField } from '@/shared/ui';

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
          // The badge stays outside the label: anything inside it becomes part of
          // the checkbox's accessible name.
          <li key={role.id} className="flex items-center gap-2">
            <CheckboxField
              id={id}
              label={role.name}
              checked={selected.includes(role.id)}
              disabled={disabled}
              onChange={() => {
                onToggle(role.id);
              }}
            />
            {role.isSystem ? <Badge>{t('create.systemBadge')}</Badge> : null}
          </li>
        );
      })}
    </ul>
  );
}
