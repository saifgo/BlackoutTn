import { useEffect, useState } from 'react';
import { Query, type Models } from 'appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_REPORTS_COLLECTION_ID,
  appwriteClient,
  databases,
} from '../appwrite/config';
import type { Report, ReportType } from '../types';
import { historyStartMs } from '../lib/status';

export interface UseReportsState {
  reports: Report[];
  loading: boolean;
  error: Error | null;
  lastUpdate: number | null;
}

const PAGE_SIZE = 100;

type ReportDoc = Models.Document & {
  zoneId?: unknown;
  userId?: unknown;
  type?: unknown;
  createdAt?: unknown;
  sectorId?: unknown;
  sectorName?: unknown;
};

function toReport(doc: ReportDoc): Report | null {
  const createdAt =
    typeof doc.createdAt === 'number'
      ? doc.createdAt
      : typeof doc.createdAt === 'string'
        ? Date.parse(doc.createdAt)
        : NaN;
  if (!Number.isFinite(createdAt)) return null;
  if (typeof doc.zoneId !== 'string' || typeof doc.userId !== 'string') return null;
  const type: ReportType =
    doc.type === 'voltage' || doc.type === 'restore' ? doc.type : 'blackout';
  const report: Report = {
    id: doc.$id,
    zoneId: doc.zoneId,
    userId: doc.userId,
    type,
    createdAt,
  };
  if (typeof doc.sectorId === 'string') report.sectorId = doc.sectorId;
  if (typeof doc.sectorName === 'string') report.sectorName = doc.sectorName;
  return report;
}

async function fetchWindow(sinceMs: number): Promise<Report[]> {
  const reports: Report[] = [];
  let cursor: string | undefined;
  // Loop pages until we drain the window. In practice with 6h of history and
  // reasonable volume this is 1-2 requests.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const queries = [
      Query.greaterThanEqual('createdAt', sinceMs),
      Query.orderDesc('createdAt'),
      Query.limit(PAGE_SIZE),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await databases.listDocuments<ReportDoc>(
      APPWRITE_DATABASE_ID,
      APPWRITE_REPORTS_COLLECTION_ID,
      queries,
    );
    for (const doc of page.documents) {
      const r = toReport(doc);
      if (r) reports.push(r);
    }
    if (page.documents.length < PAGE_SIZE) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return reports;
}

export function useReports(enabled: boolean = true): UseReportsState {
  const [state, setState] = useState<UseReportsState>({
    reports: [],
    loading: true,
    error: null,
    lastUpdate: null,
  });

  useEffect(() => {
    if (!enabled) return;
    if (!APPWRITE_DATABASE_ID || !APPWRITE_REPORTS_COLLECTION_ID) return;

    let cancelled = false;
    const sinceMs = historyStartMs();

    fetchWindow(sinceMs)
      .then((reports) => {
        if (cancelled) return;
        setState({ reports, loading: false, error: null, lastUpdate: Date.now() });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: err as Error }));
      });

    // Only the changed document is pushed, not the whole set — much cheaper
    // than the previous Firestore snapshot listener.
    const channel = `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_REPORTS_COLLECTION_ID}.documents`;
    const unsubscribe = appwriteClient.subscribe<ReportDoc>(channel, (event) => {
      if (cancelled) return;
      const isCreate = event.events.some((e) => e.endsWith('.create'));
      if (!isCreate) return;
      const r = toReport(event.payload);
      if (!r) return;
      const cutoff = historyStartMs();
      if (r.createdAt < cutoff) return;
      setState((prev) => {
        if (prev.reports.some((existing) => existing.id === r.id)) return prev;
        return {
          reports: [r, ...prev.reports],
          loading: false,
          error: null,
          lastUpdate: Date.now(),
        };
      });
    });

    return () => {
      cancelled = true;
      try {
        unsubscribe();
      } catch {
        /* noop */
      }
    };
  }, [enabled]);

  return state;
}
