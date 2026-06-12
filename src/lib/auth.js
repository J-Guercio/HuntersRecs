// Auth state + allowlist gating.
//
// Status flow:
//   'local'    — Firebase not configured; app runs open with localStorage.
//   'loading'  — waiting on the initial auth state.
//   'signedOut'— no user; show the login wall.
//   'allowed'  — signed in AND on the allowlist; show the app, sync to cloud.
//   'denied'   — signed in but NOT on the allowlist; show access-denied.
//
// The allowlist is a Firestore collection `allowlist/{email}`. Security rules
// let a signed-in user read ONLY their own allowlist doc, so the client can
// tell whether access was granted. The rules are the real gate — the per-user
// data doc is unreadable/unwritable unless the email is allowlisted.
import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from './firebase.js';

export function useAuth() {
  const [status, setStatus] = useState(isFirebaseConfigured ? 'loading' : 'local');
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    return onAuthStateChanged(auth, async (u) => {
      setError('');
      setIsAdmin(false);
      if (!u) {
        setUser(null);
        setStatus('signedOut');
        return;
      }
      setUser(u);
      // Verified email is required by the rules; reflect that in the UI too.
      if (!u.email || !u.emailVerified) {
        setStatus('denied');
        return;
      }
      try {
        // Doc IDs are lowercase emails (Google emails already are). Admins are
        // implicitly allowed; otherwise the user must be on the allowlist.
        const email = u.email.toLowerCase();
        const [adminSnap, allowSnap] = await Promise.all([
          getDoc(doc(db, 'admins', email)),
          getDoc(doc(db, 'allowlist', email)),
        ]);
        setIsAdmin(adminSnap.exists());
        setStatus(adminSnap.exists() || allowSnap.exists() ? 'allowed' : 'denied');
      } catch {
        // A permission error here means not allowlisted (or offline).
        setStatus('denied');
      }
    });
  }, []);

  const signIn = useCallback(async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        setError(e?.message || 'Sign-in failed.');
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    // Clear the per-user local cache so nothing survives for the next account
    // on a shared device.
    try {
      localStorage.removeItem('okc-hunters-recs:v1');
      localStorage.removeItem('okc-hunters-recs:selection:v1');
    } catch {
      /* ignore */
    }
    return fbSignOut(auth);
  }, []);

  return { status, user, isAdmin, error, signIn, signOut };
}
