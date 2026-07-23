import { useEffect, useState } from 'react';
import {
  Timestamp,
  collection,
  onSnapshot,
  query,
  where,
  type QuerySnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Report, ReportType } from '../types';
import { historyStartMs } from '../lib/status';

export interface UseReportsState {
  reports: Report[];
  loading: boolean;
  error: Error | null;
  lastUpdate: number | null;
}

function toReport(id: string, data: DocumentData): Report | null {
  const createdAtRaw = data.createdAt;
  const createdAt =
    createdAtRaw instanceof Timestamp
      ? createdAtRaw.toMillis()
      : typeof createdAtRaw === 'number'
        ? createdAtRaw
        : null;
  if (createdAt === null) return null;
  if (typeof data.zoneId !== 'string' || typeof data.userId !== 'string') return null;
  const type: ReportType =
    data.type === 'voltage' || data.type === 'restore' ? data.type : 'blackout';
  const report: Report = { id, zoneId: data.zoneId, userId: data.userId, type, createdAt };
  if (typeof data.sectorId === 'string') report.sectorId = data.sectorId;
  if (typeof data.sectorName === 'string') report.sectorName = data.sectorName;
  return report;
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
    const since = Timestamp.fromMillis(historyStartMs());
    const q = query(collection(db, 'reports'), where('createdAt', '>=', since));

    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const reports: Report[] = [];
        snapshot.forEach((docSnap) => {
          const r = toReport(docSnap.id, docSnap.data());
          if (r) reports.push(r);
        });
        setState({ reports, loading: false, error: null, lastUpdate: Date.now() });
      },
      (err) => {
        setState((prev) => ({ ...prev, loading: false, error: err as Error }));
      },
    );

    return unsubscribe;
  }, [enabled]);

  return state;
}
