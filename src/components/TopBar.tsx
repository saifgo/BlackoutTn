import type { User } from 'firebase/auth';
import { SearchBox } from './SearchBox';
import { UserMenu } from './UserMenu';
import type { ZoneFeatureCollection } from '../types';

interface TopBarProps {
  zones: ZoneFeatureCollection | null;
  onSelectZone: (zoneId: string) => void;
  onOpenStats: () => void;
  user: User | null;
  authActionPending: boolean;
  onOpenSignIn: () => void;
  onSignOut: () => void;
}

export function TopBar({
  zones,
  onSelectZone,
  onOpenStats,
  user,
  authActionPending,
  onOpenSignIn,
  onSignOut,
}: TopBarProps) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-[1000] flex items-center gap-2 px-3 pt-3 sm:px-4 sm:pt-4"
      role="banner"
    >
      <div className="card flex w-full items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3">
        <div className="flex items-center gap-2 pl-1 pr-1 sm:pr-2">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500 text-slate-950"
          >
            <BoltIcon className="h-5 w-5" />
          </span>
          <span className="hidden text-sm font-bold text-slate-100 sm:inline">BlackoutTN</span>
        </div>
        <SearchBox zones={zones} onSelect={onSelectZone} />
        <button
          type="button"
          onClick={onOpenStats}
          aria-label="Ouvrir les statistiques"
          className="btn-secondary shrink-0 !min-h-[40px] !px-3 !py-2 text-xs sm:text-sm"
        >
          <ChartIcon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Stats</span>
        </button>
        <UserMenu
          user={user}
          actionPending={authActionPending}
          onOpenSignIn={onOpenSignIn}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}

function BoltIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z" />
    </svg>
  );
}

function ChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
