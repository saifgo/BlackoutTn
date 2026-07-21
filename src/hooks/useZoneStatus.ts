import { useEffect, useMemo, useState } from 'react';
import { aggregateReports } from '../lib/status';
import type { Report, ZoneAggregate } from '../types';

export function useZoneStatus(reports: Report[]): Map<string, ZoneAggregate> {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return useMemo(() => aggregateReports(reports, now), [reports, now]);
}
