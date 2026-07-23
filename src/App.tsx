import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TopBar } from './components/TopBar';
import { BottomPanel } from './components/BottomPanel';
import { StatsPanel } from './components/StatsPanel';
import { Timeline } from './components/Timeline';
import { findZoneIdAtPoint, loadZones } from './lib/geo';
import { trackEvent } from './firebase/analytics';
import { useAuth } from './hooks/useAuth';
import { useReports } from './hooks/useReports';
import { useZoneStatus } from './hooks/useZoneStatus';
import { historyStartMs } from './lib/status';

const MapView = lazy(() =>
  import('./components/Map/MapView').then((m) => ({ default: m.MapView })),
);

const SignInDialog = lazy(() =>
  import('./components/SignInDialog').then((m) => ({ default: m.SignInDialog })),
);

export default function App() {
  const auth = useAuth();
  const zonesQuery = useQuery({
    queryKey: ['zones'],
    queryFn: loadZones,
    staleTime: Infinity,
  });
  const { reports, lastUpdate, error: reportsError } = useReports(!!auth.user);
  // `null` = follow the live clock; a timestamp freezes the map to that instant.
  const [timelineTime, setTimelineTime] = useState<number | null>(null);
  const aggregates = useZoneStatus(reports, timelineTime);

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.add('overflow-hidden');
    return () => document.body.classList.remove('overflow-hidden');
  }, []);

  const authError = useMemo(() => {
    if (auth.error) return 'المصادقة مش متوفرة.';
    if (reportsError) return 'الاتصال بالمعطيات المباشرة تقطع.';
    return null;
  }, [auth.error, reportsError]);

  function selectZone(id: string | null, source: string) {
    if (id) trackEvent('zone_selected', { source });
    setSelectedZoneId(id);
  }

  function handleReportShortcut() {
    trackEvent('report_shortcut_clicked');
    if (!zonesQuery.data) return;
    if (selectedZoneId) return;
    // Aggregates are keyed by sector id, so the busiest zone is already the
    // sector the popup expects.
    const withReports = Array.from(aggregates.values()).sort((a, b) => b.count - a.count);
    const topSectorId = withReports[0]?.zoneId ?? null;
    const features = zonesQuery.data.features;
    const first = topSectorId ?? features[0]?.properties.id ?? null;
    if (first) selectZone(first, 'report_shortcut');
  }

  function handleLocate() {
    trackEvent('locate_clicked');
    const zones = zonesQuery.data;
    if (!zones) return;
    if (!('geolocation' in navigator)) {
      setLocateError('تحديد الموقع مش متوفر على الجهاز هذا.');
      trackEvent('locate_unavailable');
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        const zoneId = findZoneIdAtPoint(zones, longitude, latitude);
        setLocating(false);
        if (zoneId) {
          selectZone(zoneId, 'locate');
          trackEvent('locate_success', { in_coverage: true });
        } else {
          setLocateError('راك برّا من المناطق المغطّاة.');
          trackEvent('locate_success', { in_coverage: false });
        }
      },
      (error) => {
        setLocating(false);
        setLocateError(
          error.code === error.PERMISSION_DENIED
            ? 'الوصول للموقع مرفوض. اسمح بتحديد الموقع.'
            : 'الموقع ماكش ملقي، عاود جرّب.',
        );
        trackEvent('locate_failed', {
          reason: error.code === error.PERMISSION_DENIED ? 'permission_denied' : 'unavailable',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="relative h-full w-full">
      <TopBar
        zones={zonesQuery.data ?? null}
        onSelectZone={(id) => selectZone(id, 'search')}
        onOpenStats={() => {
          trackEvent('stats_opened');
          setStatsOpen(true);
        }}
        user={auth.user}
        authActionPending={auth.actionPending}
        onOpenSignIn={() => {
          trackEvent('sign_in_dialog_opened');
          setSignInOpen(true);
        }}
        onSignOut={() => {
          trackEvent('sign_out_clicked');
          void auth.signOut();
        }}
      />

      <main className="absolute inset-0" aria-label="خريطة قطوعات الكهرباء">
        {zonesQuery.isLoading && <LoadingOverlay label="جاري تحميل الخريطة..." />}
        {zonesQuery.error && (
          <ErrorOverlay message="ما نجّمناش نحمّلو الحدود الإدارية. تثبّت من الاتصال متاعك." />
        )}
        {zonesQuery.data && (
          <Suspense fallback={<LoadingOverlay label="جاري تحميل الخريطة..." />}>
            <MapView
              zones={zonesQuery.data}
              aggregates={aggregates}
              user={auth.user}
              reports={reports}
              selectedZoneId={selectedZoneId}
              onSelectZone={(id) => selectZone(id, 'map')}
              userLocation={userLocation}
            />
          </Suspense>
        )}
      </main>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex flex-col items-center gap-2 px-3 pb-3 sm:px-4 sm:pb-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
      >
        {auth.user && (
          <Timeline
            reports={reports}
            startTime={historyStartMs()}
            value={timelineTime}
            onChange={(t) => {
              if (t !== null && timelineTime === null) trackEvent('timeline_scrubbed');
              setTimelineTime(t);
            }}
          />
        )}
        <BottomPanel
          onReport={handleReportShortcut}
          authReady={!!auth.user}
          authError={authError}
          onLocate={handleLocate}
          locating={locating}
          locateError={locateError}
        />
      </div>

      <StatsPanel
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        aggregates={aggregates}
        zones={zonesQuery.data ?? null}
        lastUpdate={lastUpdate}
      />

      {signInOpen && (
        <Suspense fallback={null}>
          <SignInDialog open={signInOpen} onClose={() => setSignInOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 grid place-items-center bg-slate-950 text-slate-200"
    >
      <div className="flex flex-col items-center gap-3">
        <div
          aria-hidden
          className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-amber-500"
        />
        <p className="text-sm">{label}</p>
      </div>
    </div>
  );
}

function ErrorOverlay({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="absolute inset-0 grid place-items-center bg-slate-950 p-6 text-center text-slate-200"
    >
      <div className="max-w-sm">
        <h2 className="mb-2 text-lg font-bold">خطأ</h2>
        <p className="text-sm text-slate-300">{message}</p>
      </div>
    </div>
  );
}
