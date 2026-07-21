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

/** Ray-casting point-in-polygon test for a single ring ([lng, lat] pairs). */
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Point is inside the polygon when it is in the outer ring but not in a hole. */
function pointInPolygon(lng: number, lat: number, polygon: number[][][]): boolean {
  if (polygon.length === 0 || !pointInRing(lng, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lng, lat, polygon[i])) return false;
  }
  return true;
}

/** Return the sector id whose polygon contains the given coordinate, if any. */
export function findZoneIdAtPoint(
  zones: ZoneFeatureCollection,
  lng: number,
  lat: number,
): string | null {
  for (const feature of zones.features) {
    const geometry = feature.geometry;
    if (geometry.type === 'Polygon') {
      if (pointInPolygon(lng, lat, geometry.coordinates as number[][][])) {
        return feature.properties.id;
      }
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates as number[][][][]) {
        if (pointInPolygon(lng, lat, polygon)) return feature.properties.id;
      }
    }
  }
  return null;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
