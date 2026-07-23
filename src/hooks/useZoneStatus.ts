import { useEffect, useMemo, useState } from 'react';
import { aggregateReports } from '../lib/status';
import type { Report, ZoneAggregate } from '../types';

/**
 * Aggregates reports into per-zone status.
 *
 * When `atTime` is `null` the hook tracks the live clock (refreshing once a
 * minute so ageing reports drop off). When a timestamp is supplied the map is
 * frozen to the state of the blackout as it was at that instant, powering the
 * timeline scrubber.
 */
export function useZoneStatus(
  reports: Report[],
  atTime: number | null = null,
): Map<string, ZoneAggregate> {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (atTime !== null) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [atTime]);

  const effectiveNow = atTime ?? now;
  return useMemo(() => aggregateReports(reports, effectiveNow), [reports, effectiveNow]);
}
