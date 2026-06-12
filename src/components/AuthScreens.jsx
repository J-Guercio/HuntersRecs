// Full-screen auth states: loading, login wall, and access-denied (+ request access).
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

function Shell({ children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">📍</div>
        <h1>OKC Hunters Recs</h1>
        {children}
      </div>
    </div>
  );
}

export function AuthLoading() {
  return (
    <Shell>
      <p className="auth-sub">Loading…</p>
    </Shell>
  );
}

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

export function LoginScreen({ onGoogle, onSignIn, onSignUp, onReset, error }) {
  const [mode, setMode] = useState('signin'); // signin | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setNotice('');
    setBusy(true);
    if (mode === 'signin') await onSignIn(email, password);
    else await onSignUp(email, password);
    setBusy(false);
  };

  const forgot = async () => {
    setNotice('');
    if (!email) {
      setNotice('Enter your email above first, then tap "Forgot password?".');
      return;
    }
    const ok = await onReset(email);
    if (ok) setNotice('Password reset email sent — check your inbox.');
  };

  return (
    <Shell>
      <p className="auth-sub">A private guide to Hunter's OKC picks. Access is limited to invited people.</p>

      <div className="seg">
        <button type="button" className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setNotice(''); }}>
          Sign in
        </button>
        <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setNotice(''); }}>
          Create account
        </button>
      </div>

      <form onSubmit={submit} className="auth-form">
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <input
          type="password"
          placeholder={mode === 'signup' ? 'Password (6+ characters)' : 'Password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          minLength={6}
          required
        />
        <button className="primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {mode === 'signin' && (
        <button type="button" className="linkbtn" onClick={forgot}>
          Forgot password?
        </button>
      )}
      {notice && <p className="auth-note">{notice}</p>}
      {error && <p className="auth-error">{error}</p>}

      <div className="auth-divider"><span>or</span></div>

      <button className="google-btn" onClick={onGoogle}>
        <GoogleMark />
        Continue with Google
      </button>

      <p className="auth-fine">
        {mode === 'signup'
          ? "We'll email you a link to verify your address before you can finish."
          : 'Your visited list, ratings, and notes stay private to your account.'}
      </p>
    </Shell>
  );
}

export function VerifyEmail({ user, onResend, onRecheck, onSignOut }) {
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);

  const resend = async () => {
    await onResend();
    setSent(true);
  };
  const check = async () => {
    setChecking(true);
    await onRecheck();
    setChecking(false);
  };

  return (
    <Shell>
      <p className="auth-sub">
        Almost there — verify your email. We sent a link to <b>{user?.email}</b>. Click it, then come back here.
      </p>
      <button className="primary" onClick={check} disabled={checking} style={{ width: '100%' }}>
        {checking ? 'Checking…' : "I've verified — continue"}
      </button>
      <button className="ghost" onClick={resend} style={{ marginTop: 8 }}>
        {sent ? 'Verification email sent ✓' : 'Resend verification email'}
      </button>
      <button className="ghost" onClick={onSignOut} style={{ marginTop: 8 }}>
        Use a different account
      </button>
    </Shell>
  );
}

export function AccessDenied({ user, db, onSignOut }) {
  const email = (user?.email || '').toLowerCase();
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [err, setErr] = useState('');

  // If they've already requested, reflect that.
  useEffect(() => {
    if (!db || !email) return undefined;
    let cancelled = false;
    getDoc(doc(db, 'accessRequests', email))
      .then((snap) => {
        if (!cancelled && snap.exists()) setState('sent');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [db, email]);

  const requestAccess = async () => {
    setErr('');
    setState('sending');
    try {
      await setDoc(doc(db, 'accessRequests', email), {
        email,
        name: user?.displayName || '',
        photo: user?.photoURL || '',
        requestedAt: serverTimestamp(),
      });
      setState('sent');
    } catch (e) {
      setState('error');
      setErr(e?.message || 'Could not send your request.');
    }
  };

  return (
    <Shell>
      {state === 'sent' ? (
        <>
          <p className="auth-sub">
            ✅ Request sent for <b>{email}</b>. You'll get in once the owner approves you.
          </p>
          <button className="primary" onClick={() => window.location.reload()} style={{ width: '100%' }}>
            Check again
          </button>
        </>
      ) : (
        <>
          <p className="auth-sub">
            You're signed in as <b>{email || 'your account'}</b>, but you're not on the guest list yet.
          </p>
          <button className="primary" onClick={requestAccess} disabled={state === 'sending' || !db} style={{ width: '100%' }}>
            {state === 'sending' ? 'Sending…' : 'Request access'}
          </button>
          {err && <p className="auth-error">{err}</p>}
        </>
      )}
      <button className="ghost" onClick={onSignOut} style={{ marginTop: 10 }}>
        Use a different account
      </button>
    </Shell>
  );
}
