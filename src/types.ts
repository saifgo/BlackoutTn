import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';

export type ReportType = 'blackout' | 'voltage' | 'restore';

/** Report types that signal an ongoing outage (counted toward map severity). */
export const OUTAGE_REPORT_TYPES: readonly ReportType[] = ['blackout', 'voltage'];

export type ZoneStatus = 'gray' | 'green' | 'yellow' | 'orange' | 'red';

export interface ZoneProperties {
  /** Unique sector (secteur / imada) id — used as the map selection key. */
  id: string;
  /** Sector (secteur / imada) name. */
  name: string;
  /** Parent delegation name. */
  delegation: string;
  /** Parent delegation id — used as the report/aggregation key (zoneId). */
  delegationId: string;
  /** Parent governorate name. */
  governorate: string;
}

export type ZoneFeatureCollection = FeatureCollection<Polygon | MultiPolygon, ZoneProperties>;

export interface Report {
  id: string;
  /** Delegation id — reports and map coloring are aggregated at this level. */
  zoneId: string;
  userId: string;
  type: ReportType;
  createdAt: number;
  /** Finer sector detail captured on the report (optional). */
  sectorId?: string;
  sectorName?: string;
}

export interface ZoneAggregate {
  zoneId: string;
  count: number;
  lastReportAt: number | null;
  status: ZoneStatus;
}
