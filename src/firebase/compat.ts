/**
 * Firebase compat SDK is only needed by FirebaseUI Auth. It is loaded lazily
 * (via dynamic import of this module from SignInDialog) so it doesn't
 * inflate the initial bundle.
 *
 * Both compat and modular Firebase share the same default App by config, so
 * `onAuthStateChanged` listeners on the modular `auth` instance fire when a
 * compat sign-in completes.
 */
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { firebaseConfigValues } from './config';

if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfigValues);
}

export const firebaseCompat = firebase;
export const authCompat = firebase.auth();
