import { ID } from 'appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_REPORTS_COLLECTION_ID,
  databases,
} from '../appwrite/config';
import type { Report, ReportType } from '../types';
import {
  GLOBAL_VOTE_LIMIT,
  GLOBAL_VOTE_WINDOW_MS,
  RATE_LIMIT_MS,
  canUserReport,
  canUserVoteGlobal,
} from './status';

export interface SubmitReportOptions {
  zoneId: string;
  userId: string;
  type: ReportType;
  existingReports: Report[];
  sectorId?: string;
  sectorName?: string;
}

export class RateLimitError extends Error {
  retryAt: number;
  constructor(retryAt: number) {
    super('Rate limit: you can only report once per zone every 15 minutes.');
    this.name = 'RateLimitError';
    this.retryAt = retryAt;
  }
}

/**
 * Thrown when a user has hit the global cap on total reports across all zones
 * within the rolling window (see GLOBAL_VOTE_LIMIT / GLOBAL_VOTE_WINDOW_MS).
 */
export class GlobalRateLimitError extends Error {
  retryAt: number;
  limit: number;
  constructor(retryAt: number) {
    super(
      `Global rate limit: you can only submit ${GLOBAL_VOTE_LIMIT} reports every ${Math.round(
        GLOBAL_VOTE_WINDOW_MS / 60_000,
      )} minutes.`,
    );
    this.name = 'GlobalRateLimitError';
    this.retryAt = retryAt;
    this.limit = GLOBAL_VOTE_LIMIT;
  }
}

export async function submitReport({
  zoneId,
  userId,
  type,
  existingReports,
  sectorId,
  sectorName,
}: SubmitReportOptions): Promise<void> {
  // Global cap first: total reports per user across all zones within the window.
  const globalCheck = canUserVoteGlobal(existingReports, userId);
  if (!globalCheck.allowed) throw new GlobalRateLimitError(globalCheck.retryAt);

  // Then the per-zone/category cooldown.
  const check = canUserReport(existingReports, userId, zoneId, type);
  if (!check.allowed) throw new RateLimitError(check.retryAt);

  const payload: Record<string, unknown> = {
    zoneId,
    userId,
    type,
    createdAt: Date.now(),
  };
  if (sectorId) payload.sectorId = sectorId;
  if (sectorName) payload.sectorName = sectorName;

  await databases.createDocument(
    APPWRITE_DATABASE_ID,
    APPWRITE_REPORTS_COLLECTION_ID,
    ID.unique(),
    payload,
  );
}

export function formatRateLimitCountdown(retryAt: number, now: number = Date.now()): string {
  const remaining = Math.max(0, retryAt - now);
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes <= 1) return 'أقل من دقيقة';
  return `${minutes} دقايق`;
}

/**
 * Formats a past timestamp as a short Tunisian Derja "من ..." relative string
 * (e.g. "من 5 دقيقة", "من 2 ساعة", "من 3 يوم"). Returns an em dash for
 * missing timestamps.
 */
export function formatRelativeTime(ts: number | null, now: number = Date.now()): string {
  if (!ts) return '\u2014';
  const diff = Math.max(0, now - ts);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'توّا';
  if (minutes < 60) return `من ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `من ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `من ${days} يوم`;
}

export const RATE_LIMIT_MINUTES = Math.round(RATE_LIMIT_MS / 60_000);
export const GLOBAL_VOTE_WINDOW_MINUTES = Math.round(GLOBAL_VOTE_WINDOW_MS / 60_000);
