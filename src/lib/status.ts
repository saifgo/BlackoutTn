import type { Report, ReportType, ZoneAggregate, ZoneStatus } from '../types';
import { OUTAGE_REPORT_TYPES } from '../types';

function isOutageReport(report: Report): boolean {
  return OUTAGE_REPORT_TYPES.includes(report.type);
}

/**
 * Reports are grouped into two categories for rate-limiting: outage signals
 * ('blackout' / 'voltage') and recovery signals ('restore'). A user may submit
 * one of each category per zone within the rate-limit window, so that saying
 * "power is back" is never blocked by a recent outage report (and vice-versa).
 */
function sameCategory(a: ReportType, b: ReportType): boolean {
  const aOutage = OUTAGE_REPORT_TYPES.includes(a);
  const bOutage = OUTAGE_REPORT_TYPES.includes(b);
  return aOutage === bOutage;
}

export const REPORT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
export const RATE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes per user per zone

export function statusForCount(count: number): ZoneStatus {
  if (count <= 0) return 'gray';
  if (count <= 4) return 'yellow';
  if (count <= 9) return 'orange';
  return 'red';
}

export const STATUS_COLORS: Record<ZoneStatus, string> = {
  gray: '#6b7280',
  yellow: '#f59e0b',
  orange: '#ea580c',
  red: '#dc2626',
};

export const STATUS_LABELS: Record<ZoneStatus, string> = {
  gray: 'Normal',
  yellow: 'Signalements isoles',
  orange: 'Coupure probable',
  red: 'Coupure confirmee',
};

export function isReportActive(report: Report, now: number = Date.now()): boolean {
  return now - report.createdAt <= REPORT_WINDOW_MS;
}

export function aggregateReports(
  reports: Report[],
  now: number = Date.now(),
): Map<string, ZoneAggregate> {
  // A 'restore' report means power came back in that zone at a given time, so
  // any outage reports predating the latest restore are considered resolved and
  // no longer count toward the map coloring. Fresh outage reports created after
  // a restore re-trigger the alert.
  const latestRestoreByZone = new Map<string, number>();
  for (const report of reports) {
    if (report.type !== 'restore' || !isReportActive(report, now)) continue;
    const prev = latestRestoreByZone.get(report.zoneId);
    if (prev === undefined || report.createdAt > prev) {
      latestRestoreByZone.set(report.zoneId, report.createdAt);
    }
  }

  const map = new Map<string, ZoneAggregate>();
  for (const report of reports) {
    if (!isOutageReport(report) || !isReportActive(report, now)) continue;
    const restoredAt = latestRestoreByZone.get(report.zoneId);
    if (restoredAt !== undefined && report.createdAt <= restoredAt) continue;
    const existing = map.get(report.zoneId);
    if (existing) {
      existing.count += 1;
      if (!existing.lastReportAt || report.createdAt > existing.lastReportAt) {
        existing.lastReportAt = report.createdAt;
      }
    } else {
      map.set(report.zoneId, {
        zoneId: report.zoneId,
        count: 1,
        lastReportAt: report.createdAt,
        status: 'yellow',
      });
    }
  }
  for (const agg of map.values()) {
    agg.status = statusForCount(agg.count);
  }
  return map;
}

export function userLastReportForZone(
  reports: Report[],
  userId: string,
  zoneId: string,
  category?: ReportType,
): Report | null {
  let latest: Report | null = null;
  for (const r of reports) {
    if (r.userId !== userId || r.zoneId !== zoneId) continue;
    if (category && !sameCategory(r.type, category)) continue;
    if (!latest || r.createdAt > latest.createdAt) latest = r;
  }
  return latest;
}

export function canUserReport(
  reports: Report[],
  userId: string,
  zoneId: string,
  category?: ReportType,
  now: number = Date.now(),
): { allowed: true } | { allowed: false; retryAt: number } {
  const last = userLastReportForZone(reports, userId, zoneId, category);
  if (!last) return { allowed: true };
  const retryAt = last.createdAt + RATE_LIMIT_MS;
  if (now >= retryAt) return { allowed: true };
  return { allowed: false, retryAt };
}
