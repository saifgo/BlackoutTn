import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Report } from '../types';
import { OUTAGE_REPORT_TYPES } from '../types';
import { isReportActive } from '../lib/status';

interface TimelineProps {
  reports: Report[];
  /** Absolute start of the history window (ms). The scrubber spans [startTime, now]. */
  startTime: number;
  /** Selected instant, or `null` when following the live clock. */
  value: number | null;
  onChange: (t: number | null) => void;
}

const BUCKETS = 60;
/** Number of discrete steps on the slider (finer = smoother scrubbing). */
const STEPS = 240;
/** How long a full play-through of the window takes, in ms. */
const PLAY_DURATION_MS = 18_000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Time only, or date + time when the window spans more than a day. */
function formatStamp(ts: number, spanMs: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (spanMs <= DAY_MS) return time;
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${date} ${time}`;
}

function formatRelative(deltaMs: number): string {
  const mins = Math.round(deltaMs / 60_000);
  if (mins <= 0) return 'توّا';
  if (mins < 60) return `من ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    const m = mins % 60;
    return m === 0 ? `من ${hours} ساعة` : `من ${hours} ساعة ${String(m).padStart(2, '0')}`;
  }
  const days = Math.floor(hours / 24);
  const h = hours % 24;
  return h === 0 ? `من ${days} يوم` : `من ${days} يوم ${h} ساعة`;
}

export function Timeline({ reports, startTime, value, onChange }: TimelineProps) {
  // The window end tracks a periodically-refreshed "now"; the start is fixed to
  // the anchor date passed in.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const max = now;
  const min = startTime;
  const windowMs = Math.max(1, max - min);
  const step = windowMs / STEPS;

  const isLive = value === null;
  const selected = value ?? max;
  // Clamp the selection into the current window (it can drift left as time passes).
  const clamped = Math.min(max, Math.max(min, selected));
  const fraction = (clamped - min) / windowMs;

  // Bucketed count of outage reports created within each slice of the window.
  const { buckets, maxBucket } = useMemo(() => {
    const arr = new Array<number>(BUCKETS).fill(0);
    for (const r of reports) {
      if (!OUTAGE_REPORT_TYPES.includes(r.type)) continue;
      const frac = (r.createdAt - min) / windowMs;
      if (frac < 0 || frac > 1) continue;
      const idx = Math.min(BUCKETS - 1, Math.floor(frac * BUCKETS));
      arr[idx] += 1;
    }
    return { buckets: arr, maxBucket: Math.max(1, ...arr) };
  }, [reports, min, windowMs]);

  // Number of reports still "active" at the selected instant — the same signal
  // that drives the map colours.
  const activeCount = useMemo(
    () =>
      reports.reduce(
        (n, r) =>
          OUTAGE_REPORT_TYPES.includes(r.type) && isReportActive(r, clamped) ? n + 1 : n,
        0,
      ),
    [reports, clamped],
  );

  const handleSlider = useCallback(
    (raw: number) => {
      // Snapping to the far right re-enables the live feed.
      if (raw >= max - step / 2) onChange(null);
      else onChange(raw);
    },
    [max, step, onChange],
  );

  // --- Playback -----------------------------------------------------------
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const posRef = useRef(clamped);
  posRef.current = clamped;

  const stopPlaying = useCallback(() => {
    setPlaying(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      stopPlaying();
      return;
    }
    // Restart from the beginning of the window when already live/at the end.
    const start = isLive || clamped >= max - step ? min : clamped;
    posRef.current = start;
    onChange(start);
    setPlaying(true);
  }, [playing, isLive, clamped, max, min, step, onChange, stopPlaying]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let lastEmit = posRef.current;
    const speed = windowMs / PLAY_DURATION_MS; // ms of history per ms of wall time
    const emitStep = windowMs / STEPS; // don't re-aggregate more than once per step
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      const next = posRef.current + dt * speed;
      if (next >= Date.now()) {
        onChange(null);
        stopPlaying();
        return;
      }
      posRef.current = next;
      // Throttle state updates so large histories don't re-render every frame.
      if (next - lastEmit >= emitStep) {
        lastEmit = next;
        onChange(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <div dir="ltr" className="card pointer-events-auto w-full max-w-2xl p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="btn-secondary !min-h-[36px] !px-2.5 !py-1"
            aria-label={playing ? 'وقّف القراية' : 'اقرا التاريخ'}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">
              {isLive ? 'مباشر' : formatStamp(clamped, windowMs)}
            </p>
            <p className="text-[11px] text-slate-400">
              {isLive ? 'الوضع الحالي' : formatRelative(max - clamped)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">{activeCount}</span> تبليغ
          </span>
          {!isLive && (
            <button
              type="button"
              onClick={() => {
                stopPlaying();
                onChange(null);
              }}
              className="btn-ghost !min-h-[32px] !px-2 !py-1 text-xs font-semibold text-amber-400"
            >
              مباشر
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        {/* Activity histogram behind the scrubber */}
        <div aria-hidden className="flex h-8 items-end gap-px">
          {buckets.map((count, i) => {
            const active = i / BUCKETS <= fraction;
            return (
              <span
                key={i}
                className="flex-1 rounded-sm transition-colors"
                style={{
                  height: `${Math.max(count > 0 ? 12 : 4, (count / maxBucket) * 100)}%`,
                  backgroundColor: active
                    ? count > 0
                      ? '#f59e0b'
                      : '#475569'
                    : count > 0
                      ? '#78350f'
                      : '#1e293b',
                }}
              />
            );
          })}
        </div>

        {/* Vertical handle marker */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 h-8 w-0.5 -translate-x-1/2 bg-white"
          style={{ left: `${fraction * 100}%` }}
        />

        <input
          type="range"
          className="timeline-range absolute inset-x-0 top-0 h-8 w-full cursor-pointer"
          min={min}
          max={max}
          step={step}
          value={clamped}
          onChange={(e) => {
            stopPlaying();
            handleSlider(Number(e.target.value));
          }}
          aria-label="الموضع في تاريخ القطوعات"
          aria-valuetext={isLive ? 'مباشر' : formatStamp(clamped, windowMs)}
        />
      </div>

      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{formatStamp(min, windowMs)}</span>
        <span>توّا</span>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
