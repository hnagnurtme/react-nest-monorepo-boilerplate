import { geoMercator, geoPath, type ExtendedFeatureCollection } from 'd3-geo';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useProvinceShapes } from '@/features/tenants/api/use-province-shapes';
import type { MyTenant } from '@/features/tenants/types';
import type { ProvinceShape } from '@/lib/geo/province-shapes';
import { VN_ARCHIPELAGOS } from '@/lib/geo/vn-archipelagos';
import { regionOf, VN_REGIONS, type VnRegion } from '@/lib/geo/vn-regions';
import { Spinner } from '@/shared/ui';

const VIEWBOX_WIDTH = 460;
const VIEWBOX_HEIGHT = 620;

/** The mainland and both archipelagos are fitted into this box together. */
const MAP_EXTENT: [[number, number], [number, number]] = [
  [2, 2],
  [458, 618],
];

/*
  Each region is drawn in its own land and coast tokens rather than in the
  accent at reduced opacity: the accent is a pin colour, and a translucent one
  over the sea takes the sea's hue with it, which is how three distinct bands
  end up looking like one. The pair is opaque and defined per theme, so the
  bands keep their separation in the dark with no `dark:` class here.
*/
const REGION_SHAPE: Record<VnRegion, string> = {
  north: 'fill-region-north-surface stroke-region-north-line',
  central: 'fill-region-central-surface stroke-region-central-line',
  south: 'fill-region-south-surface stroke-region-south-line',
};

const REGION_ACCENT: Record<VnRegion, string> = {
  north: 'fill-region-north stroke-region-north',
  central: 'fill-region-central stroke-region-central',
  south: 'fill-region-south stroke-region-south',
};

/** The leader line's length, from the coast anchor to the label. */
const CALLOUT_RUN = 30;
/** The least the three callout labels may be apart, so none sits on another. */
const CALLOUT_GAP = 30;
/** How far past the band's easternmost centroid the leader starts. */
const ANCHOR_OFFSHORE = 6;

/*
  The hover card is laid out in user units by hand: SVG has no text metrics
  before paint, and a `foreignObject` would need the whole token stack again
  inside it. `text-caption` is 11px semibold, so 6.4 units a character is a
  safe over-estimate — the box is never too narrow for its text.
*/
const TOOLTIP_CHAR = 6.4;
const TOOLTIP_PAD = 8;
const TOOLTIP_LINE = 13;
/** Names listed in full before the rest become "+n". */
const TOOLTIP_MAX_ROWS = 4;
/** The pointer target around a pin — well over the 5-unit dot it covers. */
const PIN_HIT_RADIUS = 13;

export interface TenantMapProps {
  tenants: MyTenant[];
  activeTenantId: string | null;
  onSelect: (tenantId: string) => void;
}

/** The islands as one GeoJSON feature, so the projection fits around them too. */
const ARCHIPELAGO_POINTS = {
  type: 'Feature' as const,
  properties: {},
  geometry: {
    type: 'MultiPoint' as const,
    coordinates: VN_ARCHIPELAGOS.flatMap((archipelago) => [
      ...archipelago.islands,
      archipelago.label,
    ]),
  },
};

/**
 * Vietnam with the provinces the account has a tenant in picked out.
 *
 * It draws the 34 post-merger provinces from a committed GeoJSON rather than a
 * tile service: the picker has to render before a tenant is chosen, offline
 * development has to work, and a map that only has to colour 34 shapes does not
 * need pan, zoom or a map provider's terms.
 *
 * Hoàng Sa and Trường Sa come from `VN_ARCHIPELAGOS` and are drawn in insets,
 * because the GeoJSON stops at the mainland outlines and Trường Sa reaches
 * 117°E — on the same projection it would halve the mainland.
 *
 * The pin sits on the province's centroid, not on the tenant: the API stores a
 * postal address, not coordinates, so a per-branch pin would be a lie drawn to
 * four decimal places. Several tenants in one province share one pin, and the
 * list beside the map is what distinguishes them.
 */
export function TenantMap({ tenants, activeTenantId, onSelect }: TenantMapProps) {
  const { t } = useTranslation('tenants');
  const shapes = useProvinceShapes();

  const byProvince = useMemo(() => {
    const map = new Map<string, MyTenant[]>();
    for (const tenant of tenants) {
      const code = tenant.detail?.provinceCode;
      if (code === null || code === undefined) continue;
      map.set(code, [...(map.get(code) ?? []), tenant]);
    }
    return map;
  }, [tenants]);

  /** Tenants per region, for the three callouts. */
  const byRegion = useMemo(() => {
    const counts: Record<VnRegion, number> = { north: 0, central: 0, south: 0 };
    for (const [code, held] of byProvince) counts[regionOf(code)] += held.length;
    return counts;
  }, [byProvince]);

  const projected = useMemo(() => {
    if (shapes.data === undefined) return null;

    /*
      Fitted to the provinces and the islands at once. Fitting the mainland
      alone and then projecting the islands would push Trường Sa, which reaches
      117°E, off the right of the canvas.
    */
    const everything: ExtendedFeatureCollection = {
      type: 'FeatureCollection',
      features: [...shapes.data.features, ARCHIPELAGO_POINTS],
    };
    const projection = geoMercator().fitExtent(MAP_EXTENT, everything);
    const path = geoPath(projection);

    const provinces = shapes.data.features.map((feature: ProvinceShape) => ({
      code: feature.properties.code,
      name: feature.properties.name,
      d: path(feature) ?? '',
      point: projection(feature.properties.centroid),
    }));

    /*
      One anchor per region, built rather than borrowed: the band's easternmost
      centroid gives the x, so the leader starts off the coast and runs out over
      the sea, and the midpoint of the band's latitudes gives the y, so the
      label sits level with the middle of the region it names.

      Taking both from one province does not work. Easternmost alone follows
      whichever end of the band bulges east — Khánh Hòa for the centre, at its
      southern tip, where the label reads as the south's. Nearest-the-middle
      alone lands inland, and the leader then crosses two provinces before it
      reaches water.
    */
    const anchors = VN_REGIONS.map((region) => {
      const band = provinces
        .filter((province) => regionOf(province.code) === region)
        .flatMap((province) => (province.point === null ? [] : [province.point]));

      if (band.length === 0) return { region, anchor: null };

      const xs = band.map((point) => point[0]);
      const ys = band.map((point) => point[1]);
      const anchor: [number, number] = [
        Math.max(...xs) + ANCHOR_OFFSHORE,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ];
      return { region, anchor };
    });

    return {
      provinces,
      anchors,
      archipelagos: VN_ARCHIPELAGOS.map((archipelago) => ({
        key: archipelago.key,
        label: projection(archipelago.label),
        islands: archipelago.islands.map((island) => projection(island)),
      })),
    };
  }, [shapes.data]);

  const [hovered, setHovered] = useState<string | null>(null);

  /*
    The three labels, north to south, pushed down until each clears the one
    above by `CALLOUT_GAP`. Khánh Hòa is the easternmost centre of the central
    band and Đồng Nai of the southern one, so their anchors are barely sixty
    units apart on the canvas and the two labels would otherwise overlap.
  */
  const callouts = useMemo(() => {
    if (projected === null) return [];
    let floor = Number.NEGATIVE_INFINITY;
    return projected.anchors.flatMap(({ region, anchor }) => {
      if (anchor === null) return [];
      const labelY = Math.max(anchor[1], floor);
      floor = labelY + CALLOUT_GAP;
      return [{ region, x: anchor[0], y: anchor[1], labelY }];
    });
  }, [projected]);

  /** Only the provinces that carry a pin, with everything the pin layer needs. */
  const pins = useMemo(() => {
    if (projected === null) return [];
    return projected.provinces.flatMap((province) => {
      const held = byProvince.get(province.code) ?? [];
      const first = held[0];
      if (first === undefined || province.point === null) return [];
      return [
        {
          code: province.code,
          name: province.name,
          x: province.point[0],
          y: province.point[1],
          held,
          first,
          isActive: held.some((tenant) => tenant.id === activeTenantId),
        },
      ];
    });
  }, [projected, byProvince, activeTenantId]);

  const tooltip = useMemo(() => {
    const pin = pins.find((candidate) => candidate.code === hovered);
    if (pin === undefined) return null;

    const names = pin.held.slice(0, TOOLTIP_MAX_ROWS).map((tenant) => tenant.name);
    const rest = pin.held.length - names.length;
    const rows = [pin.name, ...names, ...(rest > 0 ? [t('map.more', { count: rest })] : [])];

    const width = Math.max(...rows.map((row) => row.length)) * TOOLTIP_CHAR + TOOLTIP_PAD * 2;
    const height = rows.length * TOOLTIP_LINE + TOOLTIP_PAD * 2 - 2;
    /*
      Above the pin by default, below it when the pin sits near the top edge,
      and never past either side: a card half off the canvas is worse than one
      on the wrong side of its pin.
    */
    const above = pin.y - PIN_HIT_RADIUS - height;
    return {
      rows,
      width,
      height,
      x: Math.min(Math.max(pin.x - width / 2, 2), VIEWBOX_WIDTH - width - 2),
      y: above < 2 ? pin.y + PIN_HIT_RADIUS : above,
    };
  }, [pins, hovered, t]);

  if (shapes.isPending) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (projected === null) {
    return (
      <p className="text-muted-foreground text-body p-6 text-center">{t('map.unavailable')}</p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${String(VIEWBOX_WIDTH)} ${String(VIEWBOX_HEIGHT)}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      role="img"
      aria-label={t('map.label')}
    >
      {/*
        The sea is painted here, not left to the panel behind: the panel is
        `sunken`, the same warm beige family as the land tints, and a coast
        only reads as a coast when the water is a different temperature from
        the ground.
      */}
      <rect
        x={0}
        y={0}
        width={VIEWBOX_WIDTH}
        height={VIEWBOX_HEIGHT}
        rx={12}
        className="fill-map-sea"
      />

      {projected.provinces.map((province) => {
        const held = byProvince.get(province.code) ?? [];
        const isActive = held.some((tenant) => tenant.id === activeTenantId);
        const isHovered = province.code === hovered;

        return (
          <path
            key={province.code}
            d={province.d}
            /*
              A province held by the account is painted in the brand and edged
              in a darker step of it, so the fill and its border read as one
              object; an empty one keeps its region's tint and that region's
              hairline. The active province carries the widest line, which is
              the only weight difference on the map.
            */
            className={
              isActive
                ? 'fill-primary-600 stroke-primary-800'
                : held.length > 0
                  ? 'fill-primary-400 stroke-primary-600'
                  : REGION_SHAPE[regionOf(province.code)]
            }
            /* The hovered pin's province is outlined too, so a cluster of pins
               still says which one the pointer is on. */
            strokeWidth={isHovered ? 1.6 : isActive ? 1.4 : 0.7}
            strokeLinejoin="round"
          />
        );
      })}

      {projected.archipelagos.map((archipelago) => (
        <g key={archipelago.key} className="pointer-events-none">
          {archipelago.islands.map((island) =>
            island === null ? null : (
              <circle
                key={`${archipelago.key}-${String(island[0])}-${String(island[1])}`}
                cx={island[0]}
                cy={island[1]}
                r={1.8}
                /* Central: Hoàng Sa is Đà Nẵng's, Trường Sa is Khánh Hòa's. */
                className="fill-region-central-line"
              />
            ),
          )}
          {archipelago.label === null ? null : (
            <text
              x={archipelago.label[0]}
              y={archipelago.label[1]}
              textAnchor="middle"
              className="fill-muted-foreground text-caption"
            >
              {t(`map.archipelago.${archipelago.key}`)}
            </text>
          )}
        </g>
      ))}

      {/*
        Three leader lines out to sea, one per region, each ending in the
        number of tenants there. The map answers "where" province by province;
        these answer "how many, north to south" without a legend block, and the
        line is what ties the number to the coast it belongs to.
      */}
      {callouts.map(({ region, x, y, labelY }) => (
        <g key={`callout-${region}`} className="pointer-events-none">
          <circle cx={x} cy={y} r={2} className={REGION_ACCENT[region]} />
          {/*
            An elbow, not a straight line: the labels are pushed apart to the
            gap below, so the end of the leader rarely sits at the latitude it
            started from, and a diagonal straight to the text crosses the coast
            it came from.
          */}
          <path
            d={`M ${String(x)} ${String(y)} H ${String(x + 12)} L ${String(x + CALLOUT_RUN - 8)} ${String(labelY)} H ${String(x + CALLOUT_RUN)}`}
            fill="none"
            className={REGION_ACCENT[region]}
            strokeWidth={1}
            strokeLinejoin="round"
          />
          <text x={x + CALLOUT_RUN + 5} y={labelY + 3} className="fill-foreground text-caption">
            {`${t(`map.region.${region}`)} · ${String(byRegion[region])}`}
          </text>
        </g>
      ))}

      {pins.map((pin) => {
        const isHovered = pin.code === hovered;

        return (
          <g key={`pin-${pin.code}`}>
            {/*
              One pin per province, and clicking it selects the first tenant
              there. With several, the list is the precise control; the pin is
              the rough one, and the hover card names them all.

              The halo, not the dot, is what grows on hover: an `r` that
              changes moves the thing the pointer is on, which on a dense
              cluster makes the pin flicker between two neighbours. The dot
              keeps its size and only gains a ring.
            */}
            {isHovered ? (
              <circle
                cx={pin.x}
                cy={pin.y}
                r={pin.isActive ? 11 : 9}
                className="fill-primary-500/25 pointer-events-none"
              />
            ) : null}
            <circle
              cx={pin.x}
              cy={pin.y}
              r={pin.isActive ? 7 : 5}
              className={
                pin.isActive
                  ? 'fill-primary-800 stroke-card pointer-events-none'
                  : 'fill-primary-600 stroke-card pointer-events-none'
              }
              strokeWidth={2}
            />
            {pin.held.length > 1 ? (
              <text
                x={pin.x}
                y={pin.y + 3}
                textAnchor="middle"
                className="fill-card text-caption pointer-events-none"
              >
                {pin.held.length}
              </text>
            ) : null}
            {/*
              The hit target is its own transparent disc: a 5-unit dot on a
              460-unit canvas is roughly 9 real pixels wide, which is under
              every pointer-target guideline, and widening the dot itself
              would cover the province.
            */}
            <circle
              cx={pin.x}
              cy={pin.y}
              r={PIN_HIT_RADIUS}
              fillOpacity={0}
              className="cursor-pointer focus-visible:outline-none"
              role="button"
              tabIndex={0}
              aria-label={`${pin.name}: ${pin.held.map((tenant) => tenant.name).join(', ')}`}
              onPointerEnter={() => {
                setHovered(pin.code);
              }}
              onPointerLeave={() => {
                setHovered((current) => (current === pin.code ? null : current));
              }}
              onFocus={() => {
                setHovered(pin.code);
              }}
              onBlur={() => {
                setHovered((current) => (current === pin.code ? null : current));
              }}
              onClick={() => {
                onSelect(pin.first.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(pin.first.id);
                }
              }}
            />
          </g>
        );
      })}

      {/*
        The hover card is drawn last so it sits over every pin, and after the
        whole pin layer rather than inside one group, which is what keeps it
        from being clipped by the next pin's artwork.
      */}
      {tooltip === null ? null : (
        <g className="pointer-events-none">
          <rect
            x={tooltip.x}
            y={tooltip.y}
            width={tooltip.width}
            height={tooltip.height}
            rx={6}
            className="fill-card stroke-border"
            strokeWidth={0.8}
          />
          {tooltip.rows.map((row, index) => (
            <text
              key={row}
              x={tooltip.x + TOOLTIP_PAD}
              y={tooltip.y + TOOLTIP_PAD + TOOLTIP_LINE * index + 8}
              className={
                index === 0 ? 'fill-foreground text-caption' : 'fill-muted-foreground text-caption'
              }
            >
              {row}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
