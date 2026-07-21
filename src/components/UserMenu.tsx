import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';

interface UserMenuProps {
  user: User | null;
  actionPending: boolean;
  onOpenSignIn: () => void;
  onSignOut: () => void;
}

export function UserMenu({
  user,
  actionPending,
  onOpenSignIn,
  onSignOut,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user || user.isAnonymous) {
    return (
      <button
        type="button"
        onClick={onOpenSignIn}
        disabled={actionPending}
        aria-label="Se connecter"
        className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow ring-1 ring-black/5 transition hover:bg-slate-100 active:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed sm:text-sm"
        style={{ minHeight: 40 }}
      >
        <GoogleIcon className="h-4 w-4" aria-hidden />
        <span>Se connecter</span>
      </button>
    );
  }

  const displayName = user.displayName ?? user.email ?? 'Utilisateur';
  const photo = user.photoURL;
  const initials = (displayName.trim()[0] ?? 'U').toUpperCase();

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Compte : ${displayName}`}
        className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-2 py-1.5 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 disabled:opacity-60"
        style={{ minHeight: 40 }}
        disabled={actionPending}
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            width={28}
            height={28}
            referrerPolicy="no-referrer"
            className="h-7 w-7 rounded-full"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-full bg-amber-500 text-xs font-bold text-slate-950"
          >
            {initials}
          </span>
        )}
        <span className="hidden max-w-[140px] truncate text-xs font-semibold sm:inline">
          {displayName}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Menu utilisateur"
          className="absolute right-0 top-full z-[1100] mt-1 w-56 overflow-hidden rounded-lg bg-slate-900/95 shadow-xl ring-1 ring-white/10 backdrop-blur"
        >
          <div className="px-3 py-2 text-xs text-slate-400">
            <div className="truncate font-semibold text-slate-100">{displayName}</div>
            {user.email && <div className="truncate">{user.email}</div>}
          </div>
          <div className="border-t border-white/10" />
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="w-full px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
          >
            Se deconnecter
          </button>
        </div>
      )}
    </div>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" {...props}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
