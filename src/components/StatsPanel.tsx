import { useMemo } from 'react';
import type { ZoneAggregate, ZoneFeatureCollection } from '../types';

interface StatsPanelProps {
  open: boolean;
  onClose: () => void;
  aggregates: Map<string, ZoneAggregate>;
  zones: ZoneFeatureCollection | null;
  lastUpdate: number | null;
}

function formatTime(ts: number | null): string {
  if (!ts) return '\u2014';
  const d = new Date(ts);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function StatsPanel({ open, onClose, aggregates, zones, lastUpdate }: StatsPanelProps) {
  const summary = useMemo(() => {
    let totalReports = 0;
    let affectedZones = 0;
    const perGovernorate = new Map<string, number>();
    // Aggregates are keyed by delegation id, so map delegation -> governorate.
    const govByDelegation = new Map<string, string>();
    if (zones) {
      for (const f of zones.features) {
        govByDelegation.set(f.properties.delegationId, f.properties.governorate);
      }
    }
    for (const agg of aggregates.values()) {
      if (agg.count <= 0) continue;
      totalReports += agg.count;
      affectedZones += 1;
      const gov = govByDelegation.get(agg.zoneId) ?? 'Inconnu';
      perGovernorate.set(gov, (perGovernorate.get(gov) ?? 0) + agg.count);
    }
    let topGov: { name: string; count: number } | null = null;
    for (const [name, count] of perGovernorate) {
      if (!topGov || count > topGov.count) topGov = { name, count };
    }
    return { totalReports, affectedZones, topGov };
  }, [aggregates, zones]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Statistiques"
      className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-6"
    >
      <div
        className="absolute inset-0 bg-black/60"
        aria-hidden
        onClick={onClose}
      />
      <div className="card relative z-10 w-full max-w-md p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Statistiques en direct</h2>
          <button
            type="button"
            className="btn-ghost !min-h-[36px] !px-2 !py-1"
            onClick={onClose}
            aria-label="Fermer les statistiques"
          >
            &#10005;
          </button>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Stat label="Signalements actifs" value={summary.totalReports.toLocaleString('fr-FR')} />
          <Stat label="Zones affectees" value={summary.affectedZones.toLocaleString('fr-FR')} />
          <Stat
            label="Gouvernorat le plus touche"
            value={summary.topGov ? `${summary.topGov.name} (${summary.topGov.count})` : '\u2014'}
          />
          <Stat label="Derniere mise a jour" value={formatTime(lastUpdate)} />
        </dl>
        <p className="mt-4 text-xs text-slate-400">
          Les signalements de plus de 6 heures sont automatiquement ignores.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-800/70 p-3 ring-1 ring-white/5">
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-white">{value}</dd>
    </div>
  );
}
