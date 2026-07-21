import { useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Report, ReportType, ZoneAggregate, ZoneProperties } from '../../types';
import { STATUS_LABELS } from '../../lib/status';
import {
  RateLimitError,
  formatRateLimitCountdown,
  submitReport,
} from '../../lib/reports';
import { trackEvent } from '../../firebase/analytics';

interface ZonePopupProps {
  zone: ZoneProperties;
  aggregate?: ZoneAggregate;
  user: User | null;
  reports: Report[];
  onClose: () => void;
}

export function ZonePopup({ zone, aggregate, user, reports, onClose }: ZonePopupProps) {
  const [submitting, setSubmitting] = useState<ReportType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(null);

  const status = aggregate?.status ?? 'gray';
  const count = aggregate?.count ?? 0;

  const disabled = useMemo(() => !user || submitting !== null, [user, submitting]);

  async function handleReport(type: ReportType) {
    if (!user) {
      setMessage('Connexion anonyme en cours, veuillez reessayer.');
      setMessageKind('error');
      return;
    }
    setSubmitting(type);
    setMessage(null);
    setMessageKind(null);
    try {
      await submitReport({
        zoneId: zone.delegationId,
        userId: user.uid,
        type,
        existingReports: reports,
        sectorId: zone.id,
        sectorName: zone.name,
      });
      setMessage(
        type === 'restore'
          ? 'Retour du courant signale. Merci !'
          : 'Signalement envoye. Merci !',
      );
      setMessageKind('success');
      trackEvent('report_submitted', {
        report_type: type,
        delegation_id: zone.delegationId,
        delegation: zone.delegation,
        governorate: zone.governorate,
      });
    } catch (err) {
      if (err instanceof RateLimitError) {
        setMessage(
          `Vous avez deja signale cette zone. Reessayez dans ${formatRateLimitCountdown(err.retryAt)}.`,
        );
        trackEvent('report_rate_limited', {
          report_type: type,
          delegation_id: zone.delegationId,
          governorate: zone.governorate,
        });
      } else {
        setMessage((err as Error).message ?? 'Erreur lors de l\u2019envoi.');
        trackEvent('report_failed', {
          report_type: type,
          delegation_id: zone.delegationId,
          governorate: zone.governorate,
        });
      }
      setMessageKind('error');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-w-[220px] text-sm" role="dialog" aria-label={`Signaler pour ${zone.name}`}>
      <div className="mb-1 text-base font-bold text-white">{zone.name}</div>
      <div className="mb-1 text-xs text-slate-400">
        {zone.delegation} &middot; {zone.governorate}
      </div>
      <div className="mb-3 text-xs text-slate-300">
        <span className="font-semibold" style={{ color: colorFor(status) }}>
          {STATUS_LABELS[status]}
        </span>{' '}
        &middot; {count} signalement{count > 1 ? 's' : ''} actif{count > 1 ? 's' : ''}{' '}
        <span className="text-slate-500">(delegation)</span>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => handleReport('blackout')}
          disabled={disabled}
          aria-label={`Signaler pas d'electricite pour ${zone.name}`}
        >
          {submitting === 'blackout' ? 'Envoi...' : 'Pas d\u2019electricite'}
        </button>
        <button
          type="button"
          className="btn-secondary w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => handleReport('voltage')}
          disabled={disabled}
          aria-label={`Signaler probleme de tension pour ${zone.name}`}
        >
          {submitting === 'voltage' ? 'Envoi...' : 'Probleme de tension'}
        </button>
        <button
          type="button"
          className="btn-secondary w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => handleReport('restore')}
          disabled={disabled}
          aria-label={`Signaler le retour du courant pour ${zone.name}`}
        >
          {submitting === 'restore' ? 'Envoi...' : 'Le courant est revenu'}
        </button>
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={onClose}
          aria-label="Annuler"
        >
          Annuler
        </button>
      </div>

      {message && (
        <p
          role={messageKind === 'error' ? 'alert' : 'status'}
          className={`mt-3 text-xs ${
            messageKind === 'error' ? 'text-red-300' : 'text-emerald-300'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function colorFor(status: string): string {
  switch (status) {
    case 'yellow':
      return '#f59e0b';
    case 'orange':
      return '#ea580c';
    case 'red':
      return '#dc2626';
    default:
      return '#94a3b8';
  }
}
