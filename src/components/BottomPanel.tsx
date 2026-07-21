import { Legend } from './Legend';

interface BottomPanelProps {
  onReport: () => void;
  authReady: boolean;
  authError: string | null;
}

export function BottomPanel({ onReport, authReady, authError }: BottomPanelProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex justify-center px-3 pb-3 sm:px-4 sm:pb-4"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
    >
      <div className="card pointer-events-auto flex w-full max-w-2xl flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1">
          <Legend />
        </div>
        <button
          type="button"
          onClick={onReport}
          disabled={!authReady}
          className="btn-primary w-full sm:w-auto disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label="Signaler une coupure"
        >
          Signaler une coupure
        </button>
        {authError && (
          <p role="alert" className="text-xs text-red-300 sm:ml-2">
            {authError}
          </p>
        )}
      </div>
    </div>
  );
}
