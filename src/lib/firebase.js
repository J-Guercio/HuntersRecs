// Firebase bootstrap. Reads config from Vite env vars (VITE_FIREBASE_*).
// If config is absent, the app runs in "local mode" (no login wall, localStorage
// only) so it still works before Firebase is wired up. The login wall + cloud
// sync activate automatically once the env vars are set.
//
// NOTE: the Firebase web config (apiKey, etc.) is NOT a secret — it's a public
// project identifier. Real security comes from Firebase Auth + Firestore rules.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Distinguish "no config at all" (intended local mode) from "some but not all"
// (a deploy mistake that would silently leave the app ungated).
const REQUIRED = ['apiKey', 'projectId', 'appId'];
const present = REQUIRED.filter((k) => config[k]);
export const isFirebaseConfigured = present.length === REQUIRED.length;
export const isPartiallyConfigured = present.length > 0 && present.length < REQUIRED.length;

if (isPartiallyConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    `[firebase] Partial config: missing ${REQUIRED.filter((k) => !config[k]).join(', ')}. ` +
      'The login wall is OFF until all VITE_FIREBASE_* vars are set.'
  );
}

let auth = null;
let db = null;
let googleProvider = null;

if (isFirebaseConfigured) {
  const app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  // Always show the account chooser instead of silently reusing one session.
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

export { auth, db, googleProvider };
