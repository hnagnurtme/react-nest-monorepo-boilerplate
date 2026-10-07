import { useTranslation } from 'react-i18next';

import type { PermissionOption } from '@/features/roles/types';
import {
  groupBySubject,
  isWriteAction,
  NO_PRESET,
  permissionKey,
  type PresetSelection,
} from '@/features/roles/utils/permissions';

const SELECT_CLASS =
  'bg-card border-border focus:border-primary focus:ring-primary/20 rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:ring-2 disabled:opacity-60';

export interface PermissionMatrixProps {
  options: readonly PermissionOption[];
  selection: PresetSelection;
  disabled?: boolean;
  onChange: (key: string, preset: string) => void;
}

/** Rows = catalog entries grouped by subject; the selector is the reach preset. */
export function PermissionMatrix({
  options,
  selection,
  disabled = false,
  onChange,
}: PermissionMatrixProps) {
  const { t } = useTranslation('roles');

  return (
    <div className="space-y-3">
      {groupBySubject(options).map(([subjectName, rows]) => (
        <fieldset key={subjectName} className="border-border rounded-xl border p-3">
          <legend className="text-foreground px-1 text-sm font-semibold">
            {t(`subjects.${subjectName}`, { defaultValue: subjectName })}
          </legend>
          <div className="space-y-2">
            {rows.map((option) => {
              const key = permissionKey(option.action, option.subject);
              const current = selection[key] ?? NO_PRESET;
              const presets =
                current !== NO_PRESET && !option.presets.includes(current as never)
                  ? [...option.presets, current]
                  : option.presets;
              const actionLabel = t(`actions.${option.action}`, { defaultValue: option.action });
              const subjectLabel = t(`subjects.${option.subject}`, {
                defaultValue: option.subject,
              });
              return (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground text-sm">{actionLabel}</p>
                    {option.description !== '' ? (
                      <p className="text-muted-foreground text-xs">{option.description}</p>
                    ) : null}
                  </div>
                  <select
                    aria-label={t('matrix.rowLabel', {
                      action: actionLabel,
                      subject: subjectLabel,
                    })}
                    className={SELECT_CLASS}
                    value={current}
                    disabled={disabled || !isWriteAction(option.action)}
                    onChange={(event) => {
                      onChange(key, event.target.value);
                    }}
                  >
                    <option value={NO_PRESET}>{t('presets.none')}</option>
                    {presets.map((preset) => (
                      <option key={preset} value={preset}>
                        {t(`presets.${preset}`, { defaultValue: preset })}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
