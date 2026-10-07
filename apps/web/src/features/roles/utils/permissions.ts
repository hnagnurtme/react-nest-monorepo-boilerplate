import { subject, type ForcedSubject } from '@casl/ability';

import type {
  PermissionInput,
  PermissionOption,
  RoleItem,
  RolePermission,
} from '@/features/roles/types';

/** Selection value for "this permission is not granted". */
export const NO_PRESET = 'none';

export type PresetSelection = Record<string, string>;

const WRITE_ACTIONS: readonly string[] = ['create', 'read', 'update', 'delete'];
const WRITE_PRESETS: readonly string[] = ['any', 'own_tenant', 'own_record'];

export const permissionKey = (action: string, subjectName: string): string =>
  `${action}:${subjectName}`;

/** CASL subject for a role row, so ownership/system conditions are evaluated. */
export function toRoleSubject(
  role: Pick<RoleItem, 'id' | 'tenantId' | 'isSystem'>,
): Pick<RoleItem, 'id' | 'tenantId' | 'isSystem'> & ForcedSubject<'Role'> {
  return subject('Role', { id: role.id, tenantId: role.tenantId, isSystem: role.isSystem });
}

export function selectionFromPermissions(permissions: readonly RolePermission[]): PresetSelection {
  const selection: PresetSelection = {};
  for (const permission of permissions) {
    selection[permissionKey(permission.action, permission.subject)] = permission.preset;
  }
  return selection;
}

/** Turns the matrix selection into the API payload, dropping "none" and unknown entries. */
export function permissionsFromSelection(
  options: readonly PermissionOption[],
  selection: PresetSelection,
): PermissionInput[] {
  const result: PermissionInput[] = [];
  for (const option of options) {
    const preset = selection[permissionKey(option.action, option.subject)];
    if (preset === undefined || preset === NO_PRESET) continue;
    if (!isWriteAction(option.action) || !isWritePreset(preset)) continue;
    result.push({ action: option.action, subject: option.subject, preset });
  }
  return result;
}

export function isWriteAction(value: string): value is PermissionInput['action'] {
  return WRITE_ACTIONS.includes(value);
}

function isWritePreset(value: string): value is PermissionInput['preset'] {
  return WRITE_PRESETS.includes(value);
}

/**
 * Rows of the matrix: everything the caller may grant, plus anything the role already
 * holds that the caller could not grant themselves (shown, but locked).
 */
export function mergeOptions(
  options: readonly PermissionOption[],
  permissions: readonly RolePermission[],
): PermissionOption[] {
  const known = new Set(options.map((option) => permissionKey(option.action, option.subject)));
  const extras = permissions
    .filter((permission) => !known.has(permissionKey(permission.action, permission.subject)))
    .map<PermissionOption>((permission) => ({
      action: permission.action,
      subject: permission.subject,
      description: '',
      presets: [permission.preset],
    }));
  return [...options, ...extras];
}

export function groupBySubject(
  options: readonly PermissionOption[],
): [string, PermissionOption[]][] {
  const groups = new Map<string, PermissionOption[]>();
  for (const option of options) {
    const group = groups.get(option.subject);
    if (group) group.push(option);
    else groups.set(option.subject, [option]);
  }
  return [...groups.entries()];
}
