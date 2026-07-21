import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { auth } from '../firebase/config';
import { signOut as fbSignOut } from '../firebase/googleAuth';
import { setAnalyticsUser, setAnalyticsUserProperties, trackEvent } from '../firebase/analytics';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
  /** True while a sign-out is in flight. */
  actionPending: boolean;
}

export interface AuthActions {
  signOut: () => Promise<void>;
}

export type UseAuthReturn = AuthState & AuthActions;

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    actionPending: false,
  });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (cancelled) return;
        if (user) {
          setAnalyticsUser(user.uid);
          setAnalyticsUserProperties({
            auth_type: user.isAnonymous ? 'anonymous' : 'google',
          });
          trackEvent('login', { method: user.isAnonymous ? 'anonymous' : 'google' });
          setState((prev) => ({ ...prev, user, loading: false, error: null }));
        } else {
          setAnalyticsUser(null);
          // No user (fresh visit or after sign-out) -> sign in anonymously
          // so the app stays instantly usable.
          signInAnonymously(auth).catch((err) => {
            if (cancelled) return;
            setState((prev) => ({
              ...prev,
              user: null,
              loading: false,
              error: err as Error,
            }));
          });
        }
      },
      (err) => {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          user: null,
          loading: false,
          error: err as Error,
        }));
      },
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, actionPending: true, error: null }));
    try {
      await fbSignOut();
      setState((prev) => ({ ...prev, actionPending: false }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        actionPending: false,
        error: err instanceof Error ? err : new Error(String(err)),
      }));
    }
  }, []);

  return { ...state, signOut };
}
