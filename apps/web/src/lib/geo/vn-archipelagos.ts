import type { Position } from '@/lib/geo/province-shapes';

export interface Archipelago {
  /** Matches the i18n key under `tenants:map.archipelago`. */
  key: 'paracel' | 'spratly';
  /** Where the group's name sits, clear of both the dots and the coast. */
  label: Position;
  /** The named features, enough of them to read as a group rather than a dot. */
  islands: Position[];
}

/**
 * Hoàng Sa and Trường Sa.
 *
 * They are not in `vn-provinces.geo.json`: the source only carries the mainland
 * administrative outlines, and the two groups belong to Đà Nẵng and Khánh Hòa
 * without appearing in either province's polygon. A map of Vietnam that stops
 * at the coast is wrong, so they are drawn from this list instead.
 *
 * Drawn in place, on the same projection as the mainland, because that is where
 * they are: the projection is fitted to the mainland and both groups together,
 * so the East Sea occupies the right of the canvas instead of being cropped.
 */
export const VN_ARCHIPELAGOS: Archipelago[] = [
  {
    key: 'paracel',
    label: [111.9, 15.1],
    islands: [
      [112.33, 16.83],
      [112.73, 16.67],
      [111.6, 16.52],
      [111.7, 16.45],
      [112.53, 16.03],
      [111.2, 15.78],
    ],
  },
  {
    key: 'spratly',
    label: [114.4, 12.4],
    islands: [
      [114.33, 11.43],
      [114.28, 11.05],
      [116.5, 10.8],
      [114.37, 10.18],
      [115.54, 9.9],
      [112.89, 9.55],
      [111.92, 8.64],
      [111.67, 8.67],
      [112.9, 7.88],
      [111.6, 7.5],
    ],
  },
];
