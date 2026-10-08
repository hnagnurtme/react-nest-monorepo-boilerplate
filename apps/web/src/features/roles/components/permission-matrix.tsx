import { useTranslation } from 'react-i18next';

import type { PermissionOption } from '@/features/roles/types';
import {
  groupBySubject,
  isWriteAction,
  NO_PRESET,
  permissionKey,
  type PresetSelection,
} from '@/features/roles/utils/permissions';
import { Select } from '@/shared/ui';

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
        <fieldset key={subjectName} className="border-border rounded-surface border p-3">
          <legend className="text-foreground text-body px-1 font-semibold">
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
                    <p className="text-foreground text-body">{actionLabel}</p>
                    {option.description !== '' ? (
                      <p className="text-muted-foreground text-label">{option.description}</p>
                    ) : null}
                  </div>
                  <Select
                    size="sm"
                    aria-label={t('matrix.rowLabel', {
                      action: actionLabel,
                      subject: subjectLabel,
                    })}
                    className="w-auto"
                    value={current}
                    disabled={disabled || !isWriteAction(option.action)}
                    options={[
                      { value: NO_PRESET, label: t('presets.none') },
                      ...presets.map((preset) => ({
                        value: preset,
                        label: t(`presets.${preset}`, { defaultValue: preset }),
                      })),
                    ]}
                    onChange={(event) => {
                      onChange(key, event.target.value);
                    }}
                  />
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
