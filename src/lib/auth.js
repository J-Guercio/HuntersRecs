// Auth state + allowlist gating. Supports Google sign-in and email/password.
//
// Status flow:
//   'local'     — Firebase not configured; app runs open with localStorage.
//   'loading'   — waiting on the initial auth state.
//   'signedOut' — no user; show the login screen.
//   'unverified'— signed in (email/password) but email not verified yet.
//   'allowed'   — signed in, verified, AND allowlisted (or admin) → show the app.
//   'denied'    — signed in & verified but NOT allowlisted → request access.
//
// Email verification is required for password accounts BEFORE the allowlist is
// even checked, mirroring the Firestore rules (which require email_verified).
import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isFirebaseConfigured } from './firebase.js';

// Friendly messages for the auth error codes users actually hit.
function authMessage(e) {
  switch (e?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong email or password.';
    case 'auth/email-already-in-use':
      return 'That email already has an account — try signing in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts — please wait a bit and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    default:
      return e?.message || 'Something went wrong. Please try again.';
  }
}

export function useAuth() {
  const [status, setStatus] = useState(isFirebaseConfigured ? 'loading' : 'local');
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');

  // Decide the gate status for a given user (shared by the listener and recheck).
  const evaluate = useCallback(async (u) => {
    setIsAdmin(false);
    if (!u) {
      setUser(null);
      setStatus('signedOut');
      return;
    }
    setUser(u);
    if (!u.email) {
      setStatus('denied');
      return;
    }
    if (!u.emailVerified) {
      setStatus('unverified');
      return;
    }
    try {
      const email = u.email.toLowerCase();
      const [adminSnap, allowSnap] = await Promise.all([
        getDoc(doc(db, 'admins', email)),
        getDoc(doc(db, 'allowlist', email)),
      ]);
      setIsAdmin(adminSnap.exists());
      setStatus(adminSnap.exists() || allowSnap.exists() ? 'allowed' : 'denied');
    } catch {
      setStatus('denied');
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return undefined;
    return onAuthStateChanged(auth, (u) => {
      setError('');
      evaluate(u);
    });
  }, [evaluate]);

  const signInGoogle = useCallback(async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const m = authMessage(e);
      if (m) setError(m);
    }
  }, []);

  const signInEmail = useCallback(async (email, password) => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      const m = authMessage(e);
      if (m) setError(m);
    }
  }, []);

  const signUpEmail = useCallback(async (email, password) => {
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(cred.user); // they land on the 'unverified' screen
    } catch (e) {
      const m = authMessage(e);
      if (m) setError(m);
    }
  }, []);

  const resendVerification = useCallback(async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  }, []);

  const resetPassword = useCallback(async (email) => {
    setError('');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return true;
    } catch (e) {
      const m = authMessage(e);
      if (m) setError(m);
      return false;
    }
  }, []);

  // After the user clicks the verification link, refresh the profile AND the ID
  // token (so Firestore rules see email_verified=true), then re-evaluate.
  const recheck = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    await u.reload();
    await u.getIdToken(true);
    await evaluate(auth.currentUser);
  }, [evaluate]);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem('okc-hunters-recs:v1');
      localStorage.removeItem('okc-hunters-recs:selection:v1');
    } catch {
      /* ignore */
    }
    return fbSignOut(auth);
  }, []);

  return {
    status,
    user,
    isAdmin,
    error,
    signInGoogle,
    signInEmail,
    signUpEmail,
    resendVerification,
    resetPassword,
    recheck,
    signOut,
  };
}
