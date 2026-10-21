export type VnRegion = 'north' | 'central' | 'south';

/** North to south, the order the map's three callouts are stacked in. */
export const VN_REGIONS: readonly VnRegion[] = ['north', 'central', 'south'];

/**
 * The three bands of the country, keyed by GSO province code.
 *
 * Only used to tint the map: a single-colour outline of 34 provinces reads as
 * one grey blob at the width the picker gives it, and the bands are the
 * division every Vietnamese reader already carries.
 */
const REGION_BY_CODE: Record<string, VnRegion> = {
  '01': 'north',
  '04': 'north',
  '08': 'north',
  '11': 'north',
  '12': 'north',
  '14': 'north',
  '15': 'north',
  '19': 'north',
  '20': 'north',
  '22': 'north',
  '24': 'north',
  '25': 'north',
  '31': 'north',
  '33': 'north',
  '37': 'north',
  '38': 'central',
  '40': 'central',
  '42': 'central',
  '44': 'central',
  '46': 'central',
  '48': 'central',
  '51': 'central',
  '52': 'central',
  '56': 'central',
  '66': 'central',
  '68': 'central',
  '75': 'south',
  '79': 'south',
  '80': 'south',
  '82': 'south',
  '86': 'south',
  '91': 'south',
  '92': 'south',
  '96': 'south',
};

/** `north` for an unknown code: the map still draws, in the wrong shade. */
export function regionOf(provinceCode: string): VnRegion {
  return REGION_BY_CODE[provinceCode] ?? 'north';
}
