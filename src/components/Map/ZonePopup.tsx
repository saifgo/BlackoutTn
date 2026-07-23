import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import type { Report, ReportType, ZoneAggregate, ZoneProperties } from '../../types';
import { STATUS_LABELS, sectorStats } from '../../lib/status';
import {
  GlobalRateLimitError,
  RateLimitError,
  formatRateLimitCountdown,
  formatRelativeTime,
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

export function ZonePopup({
  zone,
  aggregate,
  user,
  reports,
  onClose,
}: ZonePopupProps) {
  const [submitting, setSubmitting] = useState<ReportType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<'success' | 'error' | null>(null);

  const status = aggregate?.status ?? 'gray';
  const count = aggregate?.count ?? 0;

  const stats = useMemo(() => sectorStats(reports, zone.id), [reports, zone.id]);

  const disabled = useMemo(
    () => !user || submitting !== null,
    [user, submitting],
  );

  async function handleReport(type: ReportType) {
    if (!user) {
      setMessage('الاتصال المجهول جاري، عاود جرّب.');
      setMessageKind('error');
      return;
    }
    setSubmitting(type);
    setMessage(null);
    setMessageKind(null);
    try {
      await submitReport({
        zoneId: zone.id,
        userId: user.uid,
        type,
        existingReports: reports,
        sectorId: zone.id,
        sectorName: zone.name,
      });
      setMessage(
        type === 'restore'
          ? 'تبليغ رجوع الضو تسجّل. يعيشك!'
          : 'التبليغ تبعث. يعيشك!',
      );
      setMessageKind('success');
      trackEvent('report_submitted', {
        report_type: type,
        delegation_id: zone.delegationId,
        delegation: zone.delegation,
        governorate: zone.governorate,
      });
    } catch (err) {
      if (err instanceof GlobalRateLimitError) {
        setMessage(
          `وصلت للحد الأقصى ${err.limit} تبليغات. عاود بعد ${formatRateLimitCountdown(err.retryAt)}.`,
        );
        trackEvent('report_rate_limited', {
          report_type: type,
          delegation_id: zone.delegationId,
          governorate: zone.governorate,
          scope: 'global',
        });
      } else if (err instanceof RateLimitError) {
        setMessage(
          `راك بلّغت على المنطقة هذي قبل. عاود بعد ${formatRateLimitCountdown(err.retryAt)}.`,
        );
        trackEvent('report_rate_limited', {
          report_type: type,
          delegation_id: zone.delegationId,
          governorate: zone.governorate,
          scope: 'zone',
        });
      } else {
        setMessage((err as Error).message ?? 'خطأ وقت الإرسال.');
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

  const accent = colorFor(status);

  return (
    <div className="flex w-full flex-col text-sm" aria-label={`بلّغ على ${zone.name}`}>
      {/* Header */}
      <div className="mb-3">
        <h2 className="text-lg font-bold leading-tight text-white">{zone.name}</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          {zone.delegation} &middot; {zone.governorate}
        </p>
        <div
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          {STATUS_LABELS[status]}
          {count > 0 && (
            <span className="text-[11px] font-medium opacity-80">
              &middot; {count} نشيط
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats.totalVotes > 0 ? (
        <div className="mb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<ChartIcon />}
              label="تبليغات (7 أيام)"
              value={String(stats.totalVotes)}
            />
            <StatCard
              icon={<UsersIcon />}
              label="المساهمين"
              value={String(stats.uniqueUsers)}
            />
          </div>
          <div className="divide-y divide-white/5 overflow-hidden rounded-lg bg-slate-800/60">
            <TimeRow
              icon={<BoltIcon />}
              iconColor="#f87171"
              label="آخر قطوعة"
              value={formatRelativeTime(stats.lastOutageAt)}
            />
            <TimeRow
              icon={<CheckIcon />}
              iconColor="#34d399"
              label="رجوع الضو"
              value={formatRelativeTime(stats.lastRestoreAt)}
            />
          </div>
        </div>
      ) : (
        <p className="mb-3 rounded-lg bg-slate-800/60 px-3 py-2.5 text-center text-xs text-slate-400">
          ما فماش تبليغات في آخر 7 أيام.
        </p>
      )}

      {/* Actions */}
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        بلّغ
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => handleReport('blackout')}
          disabled={disabled}
          aria-label={`بلّغ اللي ما فماش ضو في ${zone.name}`}
        >
          <BoltIcon />
          {submitting === 'blackout' ? 'جاري الإرسال...' : 'ما فماش ضو'}
        </button>
        <button
          type="button"
          className="btn-secondary w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={() => handleReport('restore')}
          disabled={disabled}
          aria-label={`بلّغ على رجوع الضو في ${zone.name}`}
        >
          {submitting === 'restore' ? 'جاري الإرسال...' : 'الضو رجع'}
        </button>
        <button
          type="button"
          className="btn-ghost w-full !py-2 text-slate-400"
          onClick={onClose}
          aria-label="سكّر"
        >
          سكّر
        </button>
      </div>

      {message && (
        <p
          role={messageKind === 'error' ? 'alert' : 'status'}
          className={`mt-3 rounded-lg px-2.5 py-2 text-xs ${
            messageKind === 'error'
              ? 'bg-red-500/10 text-red-300'
              : 'bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-800/60 p-2.5">
      <div className="flex items-center gap-1.5 text-slate-400">
        <span className="text-slate-500">{icon}</span>
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-xl font-bold leading-none text-white">{value}</div>
    </div>
  );
}

function TimeRow({
  icon,
  iconColor,
  label,
  value,
}: {
  icon: ReactNode;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-2">
      <span className="flex items-center gap-1.5 text-xs text-slate-400">
        <span style={{ color: iconColor }}>{icon}</span>
        {label}
      </span>
      <span className="text-xs font-semibold text-slate-200">{value}</span>
    </div>
  );
}

function colorFor(status: string): string {
  switch (status) {
    case 'green':
      return '#16a34a';
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

function BoltIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  );
}
