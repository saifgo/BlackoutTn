import { Legend } from './Legend';

interface BottomPanelProps {
  onReport: () => void;
  authReady: boolean;
  authError: string | null;
  onLocate: () => void;
  locating: boolean;
  locateError: string | null;
}

export function BottomPanel({
  onReport,
  authReady,
  authError,
  onLocate,
  locating,
  locateError,
}: BottomPanelProps) {
  return (
    <div className="card pointer-events-auto flex w-full max-w-2xl flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex-1">
        <Legend />
      </div>
      <button
        type="button"
        onClick={onLocate}
        disabled={locating}
        className="btn-secondary w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label="Trouver ma position et ouvrir ma zone"
      >
        <LocationIcon />
        {locating ? 'Localisation...' : 'Ma position'}
      </button>
      <button
        type="button"
        onClick={onReport}
        disabled={!authReady}
        className="btn-primary w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label="Signaler une coupure"
      >
        Signaler une coupure
      </button>
      {(authError || locateError) && (
        <p role="alert" className="text-xs text-red-300 sm:ml-2">
          {authError ?? locateError}
        </p>
      )}
    </div>
  );
}

function LocationIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}
