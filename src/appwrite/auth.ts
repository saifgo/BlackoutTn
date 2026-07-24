import { OAuthProvider, type Models } from 'appwrite';
import { account } from './config';
import type { AppUser } from '../types';

/**
 * Map an Appwrite account object into the app's user shape.
 *
 * Anonymous sessions have no email (and no OAuth identity), which is how we
 * distinguish them from a signed-in Google user. `photoURL` is `null` unless a
 * provider is wired to sync a picture into `prefs.photoURL`.
 */
export function mapAccount(user: Models.User<Models.Preferences>): AppUser {
  const prefs = (user.prefs ?? {}) as { photoURL?: string };
  return {
    id: user.$id,
    isAnonymous: !user.email,
    displayName: user.name || null,
    email: user.email || null,
    photoURL: prefs.photoURL ?? null,
  };
}

/**
 * Ensure a session exists. If the user is not authenticated, create an
 * anonymous session. Returns the current user or throws if that fails.
 */
export async function ensureSession(): Promise<AppUser> {
  try {
    const user = await account.get();
    return mapAccount(user);
  } catch {
    await account.createAnonymousSession();
    const user = await account.get();
    return mapAccount(user);
  }
}

/**
 * Redirect the browser to Google's OAuth2 consent screen. On success the
 * browser is redirected back to `successUrl` with the session cookie set.
 *
 * If the user is currently anonymous, Appwrite converts the anonymous account
 * into a permanent Google-linked account in-place, preserving the user `$id`
 * (and therefore all their existing reports).
 */
export function signInWithGoogle(): void {
  const successUrl = window.location.origin + window.location.pathname;
  const failureUrl = window.location.origin + window.location.pathname + '?auth=failed';
  account.createOAuth2Session(OAuthProvider.Google, successUrl, failureUrl);
}

/**
 * Sign the user out of Appwrite. `useAuth` will automatically re-create an
 * anonymous session so the app stays usable.
 */
export async function signOut(): Promise<void> {
  try {
    await account.deleteSession('current');
  } catch {
    /* No active session — nothing to do. */
  }
}
