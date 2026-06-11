// Persistent per-place tracking state (visited / priority / notes / rating),
// kept in localStorage and exposed through a tiny React hook.
import { useCallback, useEffect, useState } from 'react';

const KEY = 'okc-hunters-recs:v1';

/** Default tracking record for a place. */
const blank = () => ({ visited: false, priority: false, note: '', rating: 0 });

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Tracking store keyed by place id.
 * Returns the map plus helpers to mutate a single place's record.
 */
export function useTracking() {
  const [tracking, setTracking] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(tracking));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [tracking]);

  const get = useCallback((id) => tracking[id] || blank(), [tracking]);

  const update = useCallback((id, patch) => {
    setTracking((prev) => {
      const cur = prev[id] || blank();
      return { ...prev, [id]: { ...cur, ...patch } };
    });
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
