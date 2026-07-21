import type { Report, ZoneAggregate, ZoneStatus } from '../types';

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
  const map = new Map<string, ZoneAggregate>();
  for (const report of reports) {
    if (!isReportActive(report, now)) continue;
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
): Report | null {
  let latest: Report | null = null;
  for (const r of reports) {
    if (r.userId !== userId || r.zoneId !== zoneId) continue;
    if (!latest || r.createdAt > latest.createdAt) latest = r;
  }
  return latest;
}

export function canUserReport(
  reports: Report[],
  userId: string,
  zoneId: string,
  now: number = Date.now(),
): { allowed: true } | { allowed: false; retryAt: number } {
  const last = userLastReportForZone(reports, userId, zoneId);
  if (!last) return { allowed: true };
  const retryAt = last.createdAt + RATE_LIMIT_MS;
  if (now >= retryAt) return { allowed: true };
  return { allowed: false, retryAt };
}
