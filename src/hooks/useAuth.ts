import { useCallback, useEffect, useState } from 'react';
import { account } from '../appwrite/config';
import { ensureSession, mapAccount, signOut as awSignOut } from '../appwrite/auth';
import type { AppUser } from '../types';
import { setAnalyticsUser, setAnalyticsUserProperties, trackEvent } from '../firebase/analytics';

export interface AuthState {
  user: AppUser | null;
  loading: boolean;
  error: Error | null;
  /** True while a sign-out is in flight. */
  actionPending: boolean;
}

export interface AuthActions {
  signOut: () => Promise<void>;
}

export type UseAuthReturn = AuthState & AuthActions;

async function currentOrAnonymous(): Promise<AppUser> {
  try {
    const user = await account.get();
    return mapAccount(user);
  } catch {
    return ensureSession();
  }
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    actionPending: false,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const user = await currentOrAnonymous();
        if (cancelled) return;
        setAnalyticsUser(user.id);
        setAnalyticsUserProperties({
          auth_type: user.isAnonymous ? 'anonymous' : 'google',
        });
        trackEvent('login', { method: user.isAnonymous ? 'anonymous' : 'google' });
        setState((prev) => ({ ...prev, user, loading: false, error: null }));
      } catch (err) {
        if (cancelled) return;
        setAnalyticsUser(null);
        setState((prev) => ({
          ...prev,
          user: null,
          loading: false,
          error: err as Error,
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, actionPending: true, error: null }));
    try {
      await awSignOut();
      // Recreate an anonymous session so the app stays usable.
      const user = await ensureSession();
      setAnalyticsUser(user.id);
      setAnalyticsUserProperties({ auth_type: 'anonymous' });
      trackEvent('login', { method: 'anonymous' });
      setState((prev) => ({
        ...prev,
        user,
        actionPending: false,
        error: null,
      }));
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
