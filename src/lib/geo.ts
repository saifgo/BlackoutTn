import type { Feature, MultiPolygon, Polygon } from 'geojson';
import type { LatLngBoundsExpression } from 'leaflet';
import type { ZoneFeatureCollection, ZoneProperties } from '../types';

let cache: Promise<ZoneFeatureCollection> | null = null;

export function loadZones(): Promise<ZoneFeatureCollection> {
  if (!cache) {
    cache = fetch('/data/tn-sectors.geojson', { cache: 'force-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load zones: ${res.status}`);
        return res.json() as Promise<ZoneFeatureCollection>;
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

export function featureBounds(
  feature: Feature<Polygon | MultiPolygon, ZoneProperties>,
): LatLngBoundsExpression | null {
  const coords: number[][] = [];
  const collect = (arr: unknown): void => {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
      coords.push(arr as number[]);
    } else {
      arr.forEach(collect);
    }
  };
  collect(feature.geometry.coordinates as unknown);
  if (coords.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lng, lat] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
