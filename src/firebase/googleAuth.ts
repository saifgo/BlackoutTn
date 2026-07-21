import { signOut as fbSignOut } from 'firebase/auth';
import { auth } from './config';

/**
 * Sign the user out. `useAuth` will automatically re-sign them in anonymously
 * so the app stays usable.
 *
 * Sign-in is handled by FirebaseUI (see components/SignInDialog.tsx).
 */
export async function signOut(): Promise<void> {
  await fbSignOut(auth);
}
