import { useEffect, useRef, useState } from 'react';
import type * as firebaseuiNs from 'firebaseui';

interface SignInDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * FirebaseUI Auth widget mounted in a modal. The `firebaseui` library and its
 * CSS are dynamically imported so they don't affect the initial bundle.
 */
export function SignInDialog({ open, onClose }: SignInDialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    let ui: firebaseuiNs.auth.AuthUI | null = null;

    (async () => {
      try {
        // Everything below is lazy-loaded so firebaseui + firebase compat SDK
        // stay out of the initial bundle.
        const [firebaseui, compat] = await Promise.all([
          import('firebaseui'),
          import('../firebase/compat'),
          import('firebaseui/dist/firebaseui.css'),
        ]);
        if (disposed || !containerRef.current) return;

        const { authCompat, firebaseCompat } = compat;

        ui =
          firebaseui.auth.AuthUI.getInstance() ??
          new firebaseui.auth.AuthUI(authCompat);

        ui.start(containerRef.current, {
          signInFlow: 'popup',
          signInOptions: [
            {
              provider: firebaseCompat.auth.GoogleAuthProvider.PROVIDER_ID,
              customParameters: { prompt: 'select_account' },
            },
          ],
          autoUpgradeAnonymousUsers: true,
          credentialHelper: firebaseui.auth.CredentialHelper.NONE,
          callbacks: {
            signInSuccessWithAuthResult: () => {
              onClose();
              return false;
            },
            signInFailure: async (uiError: {
              code: string;
              credential?: Parameters<typeof authCompat.signInWithCredential>[0];
            }) => {
              // Merge conflict: anonymous user tried to upgrade to a Google
              // account that already exists in this Firebase project. Firebase's
              // recommended pattern is to sign in with the existing credential
              // and drop the anonymous UID.
              if (uiError.code === 'firebaseui/anonymous-upgrade-merge-conflict') {
                if (!uiError.credential) return;
                try {
                  await authCompat.signInWithCredential(uiError.credential);
                  onClose();
                } catch (err) {
                  setError(
                    (err as Error).message ??
                      'Impossible de se connecter avec ce compte Google.',
                  );
                }
              }
            },
          },
        });
      } catch (err) {
        setError((err as Error).message ?? 'Chargement de la connexion impossible.');
      }
    })();

    return () => {
      disposed = true;
      try {
        ui?.reset();
      } catch {
        /* noop */
      }
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Se connecter"
      className="fixed inset-0 z-[1200] flex items-center justify-center p-3 sm:p-6"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div className="card relative z-10 w-full max-w-sm p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Se connecter</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="btn-ghost !min-h-[36px] !px-2 !py-1"
          >
            &#10005;
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Connectez-vous avec Google pour retrouver vos signalements. La
          navigation anonyme reste disponible sans compte.
        </p>
        <div ref={containerRef} className="firebaseui-host" />
        {error && (
          <p role="alert" className="mt-3 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
