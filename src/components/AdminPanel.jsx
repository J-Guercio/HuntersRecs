// Admin-only modal to manage the allowlist (who can sign in).
// All writes are also enforced by firestore.rules (admin-only) — this is the UI.
import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Only trust Google profile-photo URLs; never render an arbitrary requester URL
// (it would beacon the admin's IP when the panel opens).
const safePhoto = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('googleusercontent.com') ? url : '';
  } catch {
    return '';
  }
};

export default function AdminPanel({ db, adminEmail, onClose }) {
  const [entries, setEntries] = useState(null); // null = loading
  const [requests, setRequests] = useState([]); // pending access requests
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Live view of the allowlist.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'allowlist'),
      (snap) => {
        const list = snap.docs.map((d) => ({ email: d.id, ...d.data() }));
        list.sort((a, b) => a.email.localeCompare(b.email));
        setEntries(list);
        setError('');
      },
      (e) => setError(e?.code === 'permission-denied' ? 'You do not have admin access.' : e.message)
    );
    return () => unsub();
  }, [db]);

  // Live view of pending access requests.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'accessRequests'),
      (snap) => {
        const list = snap.docs.map((d) => ({ email: d.id, ...d.data() }));
        list.sort((a, b) => (a.requestedAt?.seconds || 0) - (b.requestedAt?.seconds || 0));
        setRequests(list);
      },
      () => {}
    );
    return () => unsub();
  }, [db]);

  const approve = async (req) => {
    setError('');
    try {
      await setDoc(doc(db, 'allowlist', req.email), { addedAt: serverTimestamp(), addedBy: adminEmail });
      await deleteDoc(doc(db, 'accessRequests', req.email));
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'Only admins can approve.' : e.message);
    }
  };

  const deny = async (req) => {
    if (!confirm(`Deny ${req.email}? They can request again later.`)) return;
    setError('');
    try {
      await deleteDoc(doc(db, 'accessRequests', req.email));
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'Only admins can deny.' : e.message);
    }
  };

  const existing = useMemo(() => new Set((entries || []).map((e) => e.email)), [entries]);

  const add = async () => {
    const email = input.trim().toLowerCase();
    setError('');
    if (!isEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (existing.has(email)) {
      setError(`${email} is already allowed.`);
      return;
    }
    setBusy(true);
    try {
      await setDoc(doc(db, 'allowlist', email), { addedAt: serverTimestamp(), addedBy: adminEmail });
      setInput('');
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'Only admins can add users.' : e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (email) => {
    if (!confirm(`Remove access for ${email}? They won't be able to sign in.`)) return;
    setError('');
    try {
      await deleteDoc(doc(db, 'allowlist', email));
    } catch (e) {
      setError(e?.code === 'permission-denied' ? 'Only admins can remove users.' : e.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Manage access</h2>
          <button className="iconbtn" onClick={onClose} title="Close">✕</button>
        </div>
        {requests.length > 0 && (
          <div className="req-block">
            <h3 className="req-head">Pending requests ({requests.length})</h3>
            {requests.map((r) => {
              const photo = safePhoto(r.photo);
              return (
              <div className="admin-row req-row" key={r.email}>
                {photo ? (
                  <img src={photo} alt="" className="avatar" referrerPolicy="no-referrer" />
                ) : (
                  <span className="avatar avatar-fallback">{(r.email || '?')[0].toUpperCase()}</span>
                )}
                <span className="admin-mail" title={r.email}>
                  {r.name ? `${r.name} · ` : ''}{r.email}
                </span>
                <button className="primary" style={{ padding: '5px 10px' }} onClick={() => approve(r)}>Approve</button>
                <button className="ghost" style={{ padding: '5px 9px' }} onClick={() => deny(r)}>Deny</button>
              </div>
              );
            })}
          </div>
        )}

        <p className="tiny" style={{ margin: '0 0 12px' }}>
          Add the Google email of anyone you want to let in. They sign in with Google and get their own
          private list. Remove an email to revoke access.
        </p>

        <div className="admin-add">
          <input
            type="text"
            placeholder="name@gmail.com"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            autoFocus
          />
          <button className="primary" onClick={add} disabled={busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
        {error && <p className="auth-error" style={{ textAlign: 'left', marginTop: 8 }}>{error}</p>}

        <div className="admin-list">
          {entries === null ? (
            <p className="tiny">Loading…</p>
          ) : entries.length === 0 ? (
            <p className="tiny">No one's been added yet. Add the first email above.</p>
          ) : (
            entries.map((e) => (
              <div className="admin-row" key={e.email}>
                <span className="admin-mail" title={e.email}>{e.email}</span>
                {e.email === adminEmail && <span className="admin-tag">you · admin</span>}
                <button className="iconbtn" onClick={() => remove(e.email)} title={`Remove ${e.email}`}>🗑</button>
              </div>
            ))
          )}
        </div>

        <p className="tiny" style={{ marginTop: 12, opacity: 0.8 }}>
          {entries?.length ? `${entries.length} ${entries.length === 1 ? 'person' : 'people'} allowed. ` : ''}
          Admins are managed in the Firebase console (the “admins” collection).
        </p>
      </div>
    </div>
  );
}
