import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

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
  const missing = (['apiKey', 'authDomain', 'projectId', 'appId'] as const).filter(
    (key) => !cfg[key],
  );
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[BlackoutTN] Missing Firebase env vars: ${missing.join(', ')}. ` +
        'Create a .env.local from .env.example. Anonymous auth and Firestore will fail until configured.',
    );
  }
}

assertConfigured(firebaseConfig);

export const firebaseConfigValues = firebaseConfig;
export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);
export const db: Firestore = getFirestore(firebaseApp);
