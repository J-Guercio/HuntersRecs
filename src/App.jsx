import { useAuth } from './lib/auth.js';
import { db, isPartiallyConfigured } from './lib/firebase.js';
import Planner from './Planner.jsx';
import { AuthLoading, LoginScreen, AccessDenied } from './components/AuthScreens.jsx';

// Loud warning if Firebase is half-configured — otherwise the login wall would
// silently be OFF and the owner might think the app is gated when it isn't.
function ConfigWarning() {
  return (
    <div className="config-warning">
      ⚠️ Firebase is only partially configured — the login wall is <b>OFF</b>. Set all{' '}
      <code>VITE_FIREBASE_*</code> env vars (and redeploy) to gate access. See FIREBASE_SETUP.md.
    </div>
  );
}

// Auth gate. When Firebase isn't configured, status is 'local' and the planner
// runs open (localStorage). Once configured, access requires an allowlisted
// Google sign-in.
export default function App() {
  const { status, user, isAdmin, error, signIn, signOut } = useAuth();

  if (status === 'loading') return <AuthLoading />;
  if (status === 'signedOut') return <LoginScreen onSignIn={signIn} error={error} />;
  if (status === 'denied') return <AccessDenied email={user?.email} onSignOut={signOut} />;

  // 'allowed' → cloud-backed planner; 'local' → open planner (no Firebase).
  return (
    <>
      {isPartiallyConfigured && <ConfigWarning />}
      <Planner user={status === 'allowed' ? user : null} db={db} isAdmin={isAdmin} onSignOut={signOut} />
    </>
  );
}
