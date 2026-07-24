import { initializeApp, type FirebaseApp } from 'firebase/app';

/**
 * Firebase is kept only for Analytics. Auth and database have been migrated
 * to Appwrite (see `src/appwrite/config.ts`).
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

function assertConfigured(cfg: typeof firebaseConfig): void {
  // Only measurementId is required for Analytics. The rest are still read so
  // Firebase initializes cleanly; analytics silently no-ops if unsupported.
  if (!cfg.apiKey || !cfg.appId) {
    // eslint-disable-next-line no-console
    console.warn(
      '[BlackoutTN] Missing Firebase env vars for Analytics. ' +
        'Create a .env.local from .env.example. Analytics will be disabled.',
    );
  }
}

assertConfigured(firebaseConfig);

export const firebaseConfigValues = firebaseConfig;
export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
