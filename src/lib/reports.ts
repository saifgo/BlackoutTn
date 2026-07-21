import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Report, ReportType } from '../types';
import { RATE_LIMIT_MS, canUserReport } from './status';

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
    super('Rate limit: you can only report once per zone every 30 minutes.');
    this.name = 'RateLimitError';
    this.retryAt = retryAt;
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
  const check = canUserReport(existingReports, userId, zoneId, type);
  if (!check.allowed) throw new RateLimitError(check.retryAt);

  const payload: Record<string, unknown> = {
    zoneId,
    userId,
    type,
    createdAt: serverTimestamp(),
  };
  if (sectorId) payload.sectorId = sectorId;
  if (sectorName) payload.sectorName = sectorName;

  await addDoc(collection(db, 'reports'), payload);
}

export function formatRateLimitCountdown(retryAt: number, now: number = Date.now()): string {
  const remaining = Math.max(0, retryAt - now);
  const minutes = Math.ceil(remaining / 60_000);
  if (minutes <= 1) return 'moins d\u2019une minute';
  return `${minutes} minutes`;
}

export const RATE_LIMIT_MINUTES = Math.round(RATE_LIMIT_MS / 60_000);
