import { useEffect, useState } from 'react';
import { signInWithGoogle } from '../appwrite/auth';

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Google sign-in dialog. Clicking the button redirects to Google's OAuth2
 * consent screen via Appwrite; on success the browser is redirected back and
 * `useAuth` picks up the new session automatically.
 */
export function SignInDialog({ open, onClose }: SignInDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // Surface an OAuth failure that redirected back with ?auth=failed.
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'failed') {
      setError('ما نجّمناش ندخلو بحساب ڤوڤل هذا.');
    }
  }, [open]);

  if (!open) return null;

  function handleGoogle() {
    setError(null);
    setSigningIn(true);
    try {
      signInWithGoogle();
    } catch (err) {
      setSigningIn(false);
      setError((err as Error).message ?? 'ما نجّمناش نحمّلو صفحة الدخول.');
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="دخول"
      className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="card relative z-10 w-full max-w-sm p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">دخول</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="سكّر"
            className="btn-ghost !min-h-[36px] !px-2 !py-1"
          >
            &#10005;
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          ادخل بڤوڤل باش تلقى التبليغات متاعك. تنجّم تستعمل الأبليكاسيون بلا
          حساب زادة.
        </p>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={signingIn}
          aria-label="دخول بحساب ڤوڤل"
          className="inline-flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow ring-1 ring-black/5 transition hover:bg-slate-100 active:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ minHeight: 44 }}
        >
          <GoogleIcon className="h-5 w-5" aria-hidden />
          <span>{signingIn ? 'جاري التحويل...' : 'ادخل بحساب ڤوڤل'}</span>
        </button>
        {error && (
          <p role="alert" className="mt-3 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
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
