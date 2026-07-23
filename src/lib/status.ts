import type { Report, ReportType, ZoneAggregate, ZoneStatus } from '../types';
import { OUTAGE_REPORT_TYPES } from '../types';

function isOutageReport(report: Report): boolean {
  return OUTAGE_REPORT_TYPES.includes(report.type);
}

/**
 * The aggregation/coloring unit is the sector (secteur / imada) so that a
 * report only lights up the specific sector it targets, not the whole parent
 * delegation. We prefer the finer `sectorId` and fall back to `zoneId` for
 * older reports that predate sector-level reporting.
 */
function sectorKey(report: Report): string {
  return report.sectorId ?? report.zoneId;
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

export const REPORT_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours (map severity window)
/**
 * Calendar day of the month the timeline history begins on. Reports are loaded
 * from this day so the scrubber can rewind to it. This is independent of
 * REPORT_WINDOW_MS: at any scrubbed instant only reports from the 6h before it
 * count toward the map colours, but we keep older reports around to reach here.
 */
export const HISTORY_START_DAY = 21;

/** Local-midnight timestamp of HISTORY_START_DAY (this month, or last month if it hasn't occurred yet). */
export function historyStartMs(now: number = Date.now()): number {
  const d = new Date(now);
  let start = new Date(d.getFullYear(), d.getMonth(), HISTORY_START_DAY, 0, 0, 0, 0);
  if (start.getTime() > now) {
    start = new Date(d.getFullYear(), d.getMonth() - 1, HISTORY_START_DAY, 0, 0, 0, 0);
  }
  return start.getTime();
}

export const RATE_LIMIT_MS = 15 * 60 * 1000; // 15 minutes per user per zone

/**
 * Global per-user cap: a single user may cast at most GLOBAL_VOTE_LIMIT reports
 * (across all zones and categories) within any rolling GLOBAL_VOTE_WINDOW_MS
 * window. This complements the per-zone cooldown (RATE_LIMIT_MS) by limiting the
 * total number of votes a single user can spread across many different zones.
 *
 * Keep GLOBAL_VOTE_WINDOW_MS <= HISTORY_WINDOW_MS so the client always has the
 * full set of recent reports needed to count accurately.
 */
export const GLOBAL_VOTE_LIMIT = 10; // max reports per user per window
export const GLOBAL_VOTE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

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
  // A report is only "active" at instant `now` if it was already created by then
  // (so historical/timeline views ignore future reports) and it is not older than
  // the retention window.
  return report.createdAt <= now && now - report.createdAt <= REPORT_WINDOW_MS;
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
    const key = sectorKey(report);
    const prev = latestRestoreByZone.get(key);
    if (prev === undefined || report.createdAt > prev) {
      latestRestoreByZone.set(key, report.createdAt);
    }
  }

  const map = new Map<string, ZoneAggregate>();
  for (const report of reports) {
    if (!isOutageReport(report) || !isReportActive(report, now)) continue;
    const key = sectorKey(report);
    const restoredAt = latestRestoreByZone.get(key);
    if (restoredAt !== undefined && report.createdAt <= restoredAt) continue;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.lastReportAt || report.createdAt > existing.lastReportAt) {
        existing.lastReportAt = report.createdAt;
      }
    } else {
      map.set(key, {
        zoneId: key,
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

export interface SectorStats {
  /** Total reports of any type ever recorded for this sector (loaded window). */
  totalVotes: number;
  /** Outage-signalling reports ('blackout' + 'voltage'). */
  outageVotes: number;
  /** Recovery reports ('restore'). */
  restoreVotes: number;
  /** Breakdown by report type. */
  byType: Record<ReportType, number>;
  /** Number of distinct users who reported this sector. */
  uniqueUsers: number;
  /** Timestamp of the most recent outage report, or null. */
  lastOutageAt: number | null;
  /** Timestamp of the most recent 'restore' report, or null. */
  lastRestoreAt: number | null;
  /** Timestamp of the most recent report of any type, or null. */
  lastReportAt: number | null;
}

/**
 * Computes cumulative stats for a single sector across all currently-loaded
 * reports (the ~7-day history window), independent of the 6h severity window
 * used for map colouring. Powers the "how many times has this been voted / when
 * was the last outage" details shown in the zone popup.
 *
 * Reports are matched to the sector the same way the map aggregation does, via
 * `sectorId ?? zoneId`, so counts line up with the coloured sectors.
 */
export function sectorStats(reports: Report[], sectorId: string): SectorStats {
  const byType: Record<ReportType, number> = { blackout: 0, voltage: 0, restore: 0 };
  const users = new Set<string>();
  let lastOutageAt: number | null = null;
  let lastRestoreAt: number | null = null;
  let lastReportAt: number | null = null;

  for (const report of reports) {
    if (sectorKey(report) !== sectorId) continue;
    byType[report.type] += 1;
    users.add(report.userId);
    if (lastReportAt === null || report.createdAt > lastReportAt) {
      lastReportAt = report.createdAt;
    }
    if (isOutageReport(report)) {
      if (lastOutageAt === null || report.createdAt > lastOutageAt) {
        lastOutageAt = report.createdAt;
      }
    } else if (report.type === 'restore') {
      if (lastRestoreAt === null || report.createdAt > lastRestoreAt) {
        lastRestoreAt = report.createdAt;
      }
    }
  }

  const outageVotes = byType.blackout + byType.voltage;
  return {
    totalVotes: outageVotes + byType.restore,
    outageVotes,
    restoreVotes: byType.restore,
    byType,
    uniqueUsers: users.size,
    lastOutageAt,
    lastRestoreAt,
    lastReportAt,
  };
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

/**
 * Returns the user's reports created within the trailing `windowMs`, sorted from
 * newest to oldest. Future-dated reports (createdAt > now) are ignored.
 */
export function userReportsInWindow(
  reports: Report[],
  userId: string,
  now: number = Date.now(),
  windowMs: number = GLOBAL_VOTE_WINDOW_MS,
): Report[] {
  const since = now - windowMs;
  return reports
    .filter((r) => r.userId === userId && r.createdAt > since && r.createdAt <= now)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Enforces the global per-user vote cap. A user may cast at most
 * GLOBAL_VOTE_LIMIT reports within any rolling GLOBAL_VOTE_WINDOW_MS window,
 * regardless of which zones they target.
 *
 * When blocked, `retryAt` is the instant the oldest vote that currently counts
 * against the cap ages out of the window, freeing up one slot. `remaining` is
 * how many votes the user still has available in the current window.
 */
export function canUserVoteGlobal(
  reports: Report[],
  userId: string,
  now: number = Date.now(),
): { allowed: true; remaining: number } | { allowed: false; retryAt: number } {
  const recent = userReportsInWindow(reports, userId, now, GLOBAL_VOTE_WINDOW_MS);
  if (recent.length < GLOBAL_VOTE_LIMIT) {
    return { allowed: true, remaining: GLOBAL_VOTE_LIMIT - recent.length };
  }
  // recent is newest-first; the vote at index (LIMIT - 1) is the oldest one that
  // still counts. Once it leaves the window a slot opens up.
  const retryAt = recent[GLOBAL_VOTE_LIMIT - 1].createdAt + GLOBAL_VOTE_WINDOW_MS;
  return { allowed: false, retryAt };
}
