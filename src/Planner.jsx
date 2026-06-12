import { useEffect, useMemo, useRef, useState } from 'react';
import { PLACES } from './data/places.js';
import { CATEGORIES, CATEGORY_COLOR } from './lib/categories.js';
import { useTracking } from './lib/storage.js';
import { optimizeRoute } from './lib/geo.js';
import MapView from './components/MapView.jsx';
import PlaceList from './components/PlaceList.jsx';
import RoutePanel from './components/RoutePanel.jsx';
import AdminPanel from './components/AdminPanel.jsx';

const SEL_KEY = 'okc-hunters-recs:selection:v1';

// Initial selection: a shared "?sel=id,id" link wins over saved localStorage,
// so routes can be shared/bookmarked.
const loadSel = () => {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('sel');
    if (fromUrl) return new Set(fromUrl.split(',').filter(Boolean));
    return new Set(JSON.parse(localStorage.getItem(SEL_KEY) || '[]'));
  } catch {
    return new Set();
  }
};
const initialTab = () =>
  new URLSearchParams(window.location.search).get('tab') === 'route' ? 'route' : 'explore';

export default function Planner({ user = null, db = null, isAdmin = false, onSignOut }) {
  const [adminOpen, setAdminOpen] = useState(false);
  // Cloud-backed per-user data when signed in; localStorage otherwise.
  const { tracking, get, update, toggleVisited, togglePriority, resetAll, importState } = useTracking(
    user && db ? { db, uid: user.uid } : undefined
  );

  const [activeCats, setActiveCats] = useState(() => new Set(CATEGORIES));
  const [query, setQuery] = useState('');
  const [hideVisited, setHideVisited] = useState(false);
  const [onlyPriority, setOnlyPriority] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [selectedIds, setSelectedIds] = useState(() => {
    const valid = new Set(PLACES.map((p) => p.id));
    return new Set([...loadSel()].filter((id) => valid.has(id)));
  });
  const [startId, setStartId] = useState('__optimal__');
  const [mode, setMode] = useState('drive');
  const [focusTarget, setFocusTarget] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('okc-hunters-recs:theme') || 'light');
  const fileRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('okc-hunters-recs:theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(SEL_KEY, JSON.stringify([...selectedIds]));
    } catch {
      /* ignore */
    }
  }, [selectedIds]);

  // ----- filtering -----
  const visiblePlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PLACES.filter((p) => {
      if (!activeCats.has(p.category)) return false;
      const t = tracking[p.id] || {};
      if (hideVisited && t.visited) return false;
      if (onlyPriority && !t.priority) return false;
      if (q && !(`${p.name} ${p.district} ${p.vibe}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [activeCats, query, hideVisited, onlyPriority, tracking]);

  const visibleIds = useMemo(() => new Set(visiblePlaces.map((p) => p.id)), [visiblePlaces]);

  // ----- route -----
  const selectedPlaces = useMemo(() => PLACES.filter((p) => selectedIds.has(p.id)), [selectedIds]);

  const { orderedPlaces, miles } = useMemo(() => {
    if (selectedPlaces.length === 0) return { orderedPlaces: [], miles: 0 };
    const startIndex = startId === '__optimal__' ? -1 : selectedPlaces.findIndex((p) => p.id === startId);
    const { order, miles } = optimizeRoute(selectedPlaces, startIndex);
    return { orderedPlaces: order.map((i) => selectedPlaces[i]), miles };
  }, [selectedPlaces, startId]);

  const routeOrder = useMemo(() => orderedPlaces.map((p) => p.id), [orderedPlaces]);

  // ----- handlers -----
  const toggleCat = (c) =>
    setActiveCats((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });

  const toggleSelect = (id) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const planCombo = (items) => {
    setSelectedIds(new Set(items.map((p) => p.id)));
    setStartId('__optimal__');
    setTab('route');
  };

  const focusPlace = (p) => setFocusTarget({ lat: p.lat, lng: p.lng, _t: Date.now() });

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ tracking, selection: [...selectedIds] }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'okc-hunters-recs-backup.json';
    a.click();
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.tracking) importState(data.tracking);
        if (Array.isArray(data.selection)) setSelectedIds(new Set(data.selection));
      } catch {
        alert('Could not read that backup file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const visitedCount = PLACES.filter((p) => tracking[p.id]?.visited).length;
  const pct = Math.round((visitedCount / PLACES.length) * 100);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div>
            <h1>📍 OKC Hunters Recs</h1>
            <p>{PLACES.length} spots from Hunter · track them, group them, route them.</p>
          </div>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="progress">
          <span>{visitedCount}/{PLACES.length} visited</span>
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
          <span>{pct}%</span>
        </div>

        <div className="tabs">
          <button className={tab === 'explore' ? 'active' : ''} onClick={() => setTab('explore')}>
            Explore & track
          </button>
          <button className={tab === 'route' ? 'active' : ''} onClick={() => setTab('route')}>
            Route {selectedIds.size > 0 && `(${selectedIds.size})`}
          </button>
        </div>

        {tab === 'explore' ? (
          <>
            <div className="toolbar">
              <input
                type="text"
                placeholder="Search places, neighborhoods…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="chips">
                {CATEGORIES.map((c) => {
                  const on = activeCats.has(c);
                  return (
                    <span
                      key={c}
                      className={`chip ${on ? 'on' : ''}`}
                      style={on ? { background: CATEGORY_COLOR[c], borderColor: CATEGORY_COLOR[c] } : undefined}
                      onClick={() => toggleCat(c)}
                    >
                      {c}
                    </span>
                  );
                })}
              </div>
              <div className="chips">
                <span className={`chip ${hideVisited ? 'on' : ''}`} style={hideVisited ? { background: '#34d399', borderColor: '#34d399' } : undefined} onClick={() => setHideVisited((v) => !v)}>
                  Hide visited
                </span>
                <span className={`chip ${onlyPriority ? 'on' : ''}`} style={onlyPriority ? { background: '#fbbf24', borderColor: '#fbbf24' } : undefined} onClick={() => setOnlyPriority((v) => !v)}>
                  ★ Priority only
                </span>
              </div>
            </div>

            <div className="scroll">
              <PlaceList
                places={visiblePlaces}
                tracking={tracking}
                selectedIds={selectedIds}
                get={get}
                onToggleSelect={toggleSelect}
                onUpdate={update}
                onToggleVisited={toggleVisited}
                onTogglePriority={togglePriority}
                onFocus={focusPlace}
                onPlanCombo={planCombo}
              />
            </div>
          </>
        ) : (
          <div className="scroll" style={{ padding: 0 }}>
            <RoutePanel
              orderedPlaces={orderedPlaces}
              miles={miles}
              mode={mode}
              onModeChange={setMode}
              startId={startId}
              onStartChange={setStartId}
              onRemove={toggleSelect}
              onClear={() => setSelectedIds(new Set())}
              onShare={() => {
                const url = `${location.origin}${location.pathname}?tab=route&sel=${[...selectedIds].join(',')}`;
                navigator.clipboard?.writeText(url).then(
                  () => alert('Route link copied to clipboard!'),
                  () => prompt('Copy this route link:', url)
                );
              }}
            />
          </div>
        )}

        <div className="foot">
          <button className="ghost" onClick={exportData}>Export backup</button>
          <button className="ghost" onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} type="file" accept="application/json" onChange={importData} style={{ display: 'none' }} />
          <span className="spacer" />
          <button
            className="ghost"
            onClick={() => {
              if (confirm('Reset all visited / ratings / notes / priorities?')) resetAll();
            }}
          >
            Reset
          </button>
        </div>

        {user && (
          <div className="account-bar">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="avatar avatar-fallback">{(user.email || '?')[0].toUpperCase()}</span>
            )}
            <span className="account-email" title={user.email}>{user.email}</span>
            {isAdmin && (
              <button className="ghost" onClick={() => setAdminOpen(true)} title="Manage who can sign in">
                Manage access
              </button>
            )}
            <button className="ghost" onClick={onSignOut}>Sign out</button>
          </div>
        )}
      </aside>

      <div className="map-wrap">
        <MapView
          places={PLACES}
          visibleIds={visibleIds}
          tracking={tracking}
          selectedIds={selectedIds}
          routeOrder={tab === 'route' ? routeOrder : null}
          focusTarget={focusTarget}
          onToggleSelect={toggleSelect}
          theme={theme}
        />
        <div className="map-legend">
          {CATEGORIES.map((c) => (
            <div className="li" key={c}>
              <span className="dot" style={{ background: CATEGORY_COLOR[c] }} />
              {c}
            </div>
          ))}
        </div>
      </div>

      {isAdmin && adminOpen && db && user && (
        <AdminPanel db={db} adminEmail={user.email?.toLowerCase()} onClose={() => setAdminOpen(false)} />
      )}
    </div>
  );
}
