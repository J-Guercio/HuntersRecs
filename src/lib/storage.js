// Per-place tracking state (visited / priority / notes / rating).
//
// Two backends behind one hook:
//   • Cloud  — when { db, uid } are given, syncs to Firestore `users/{uid}`
//              with realtime updates across devices. On first sign-in, any
//              existing localStorage progress is migrated into the cloud doc.
//   • Local  — otherwise, persists to localStorage (works with no Firebase).
import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const KEY = 'okc-hunters-recs:v1';

const blank = () => ({ visited: false, priority: false, note: '', rating: 0 });

function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * @param {{ db?: object, uid?: string }} [opts] cloud backend; omit for local.
 */
export function useTracking({ db, uid } = {}) {
  const cloud = Boolean(db && uid);
  const [tracking, setTracking] = useState(() => (cloud ? {} : loadLocal()));
  const readyRef = useRef(!cloud); // local is ready immediately; cloud waits for first snapshot
  const fromSnapshotRef = useRef(false); // true when `tracking` was just set from a remote snapshot
  const writeTimer = useRef(null);

  // ----- load / subscribe -----
  useEffect(() => {
    if (!cloud) {
      readyRef.current = false;
      setTracking(loadLocal());
      readyRef.current = true;
      return undefined;
    }

    readyRef.current = false;
    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.metadata.hasPendingWrites) return; // ignore our own optimistic echo
        if (snap.exists()) {
          fromSnapshotRef.current = true; // this state came from the server; don't echo it back
          setTracking(snap.data().tracking || {});
          readyRef.current = true;
        } else {
          // First time: migrate any local progress into the new cloud doc.
          const local = loadLocal();
          setTracking(local);
          setDoc(ref, { tracking: local, updatedAt: serverTimestamp() }, { merge: true }).finally(
            () => {
              readyRef.current = true;
            }
          );
        }
      },
      () => {
        readyRef.current = true; // give up gracefully on subscribe errors
      }
    );
    return () => unsub();
  }, [cloud, db, uid]);

  // ----- persist -----
  useEffect(() => {
    if (!readyRef.current) return undefined;
    if (fromSnapshotRef.current) {
      fromSnapshotRef.current = false; // remote-origin state; skip the echo write
      return undefined;
    }
    if (!cloud) {
      try {
        localStorage.setItem(KEY, JSON.stringify(tracking));
      } catch {
        /* quota / private mode */
      }
      return undefined;
    }
    clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      setDoc(doc(db, 'users', uid), { tracking, updatedAt: serverTimestamp() }, { merge: true }).catch(
        () => {}
      );
    }, 600);
    return () => clearTimeout(writeTimer.current);
  }, [tracking, cloud, db, uid]);

  const get = useCallback((id) => tracking[id] || blank(), [tracking]);

  const update = useCallback((id, patch) => {
    setTracking((prev) => ({ ...prev, [id]: { ...(prev[id] || blank()), ...patch } }));
  }, []);

  const toggleVisited = useCallback((id) => {
    setTracking((prev) => {
      const cur = prev[id] || blank();
      return { ...prev, [id]: { ...cur, visited: !cur.visited } };
    });
  }, []);

  const togglePriority = useCallback((id) => {
    setTracking((prev) => {
      const cur = prev[id] || blank();
      return { ...prev, [id]: { ...cur, priority: !cur.priority } };
    });
  }, []);

  const resetAll = useCallback(() => setTracking({}), []);

  const importState = useCallback((obj) => {
    if (obj && typeof obj === 'object') setTracking(obj);
  }, []);

  return { tracking, get, update, toggleVisited, togglePriority, resetAll, importState };
}
