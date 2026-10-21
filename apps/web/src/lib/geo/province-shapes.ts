/** `[longitude, latitude]`, the order GeoJSON and d3-geo both use. */
export type Position = [number, number];

export interface ProvinceShape {
  type: 'Feature';
  properties: {
    /** The GSO code, so it joins to `detail.provinceCode` from the API. */
    code: string;
    name: string;
    /**
     * Precomputed from the largest polygon when the asset was built: taking the
     * centroid of the whole MultiPolygon would drag a coastal province out to
     * sea between its islands.
     */
    centroid: Position;
  };
  geometry: { type: 'MultiPolygon'; coordinates: Position[][][] };
}

export interface ProvinceShapes {
  type: 'FeatureCollection';
  features: ProvinceShape[];
}

/** Where the build puts the asset. One spelling, like every other path. */
export const PROVINCE_SHAPES_URL = '/vn-provinces.geo.json';

/**
 * The 34 post-merger province outlines.
 *
 * A static asset on our own origin, not an API call: it is a picture, it never
 * varies by caller, and the tenant picker needs it before a tenant is chosen.
 * It lives in `lib/` because `fetch` is banned in features (rule D1) — a rule
 * about auth headers, which this request deliberately has none of.
 *
 * Simplified to about 65 KB when the asset was built: invisible at the size the
 * picker draws it, and small enough that caching it forever is honest.
 */
export async function loadProvinceShapes(): Promise<ProvinceShapes> {
  const response = await fetch(PROVINCE_SHAPES_URL);
  if (!response.ok) {
    throw new Error(`Could not load the province outlines (${String(response.status)})`);
  }

  return (await response.json()) as ProvinceShapes;
}
