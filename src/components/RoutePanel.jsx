import { haversine, estimateMinutes, googleMapsRouteUrl } from '../lib/geo.js';
import { colorFor, iconFor } from '../lib/categories.js';

export default function RoutePanel({ orderedPlaces, miles, mode, onModeChange, startId, onStartChange, onRemove, onClear, onShare }) {
  if (!orderedPlaces.length) {
    return (
      <div className="route-empty">
        No stops yet.
        <br />
        Add places with <b>+ Route</b> in the list or map, or hit <b>Plan combo →</b> on a neighborhood.
      </div>
    );
  }

  const totalMin = estimateMinutes(miles, mode);
  const url = googleMapsRouteUrl(orderedPlaces.map((p) => ({ lat: p.lat, lng: p.lng })));

  return (
    <>
      <div className="toolbar" style={{ borderTop: '1px solid var(--line)' }}>
        <label className="tiny">Start:</label>
        <select value={startId} onChange={(e) => onStartChange(e.target.value)} style={{ width: 'auto', flex: 1 }}>
          <option value="__optimal__">Optimal (let app choose)</option>
          {orderedPlaces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button className={mode === 'drive' ? 'primary' : ''} onClick={() => onModeChange('drive')} title="Driving">
          🚗
        </button>
        <button className={mode === 'walk' ? 'primary' : ''} onClick={() => onModeChange('walk')} title="Walking">
          🚶
        </button>
      </div>

      <div className="route-summary">
        <div>
          <b>{orderedPlaces.length}</b>
          <span>stops</span>
        </div>
        <div>
          <b>{miles.toFixed(1)}</b>
          <span>miles</span>
        </div>
        <div>
          <b>{totalMin}</b>
          <span>min {mode === 'walk' ? 'walking' : 'driving'}</span>
        </div>
      </div>

      <div style={{ padding: '0 4px' }}>
        {orderedPlaces.map((p, i) => {
          const legMi = i === 0 ? 0 : haversine(orderedPlaces[i - 1], p);
          return (
            <div key={p.id} className="route-stop">
              <span className="n">{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {iconFor(p.category)} {p.name}
                </div>
                <div className="leg">
                  {p.district}
                  {i > 0 && ` · ${legMi.toFixed(1)} mi (${estimateMinutes(legMi, mode)} min) from #${i}`}
                </div>
              </div>
              <span className="dot" style={{ background: colorFor(p.category) }} />
              <button className="iconbtn" onClick={() => onRemove(p.id)} title="Remove stop">
                ✕
              </button>
            </div>
          );
        })}
      </div>

      <div className="foot">
        <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <button className="primary">Open route in Google Maps ↗</button>
        </a>
        <button className="ghost" onClick={onShare}>
          Copy link
        </button>
        <span className="spacer" />
        <button className="ghost" onClick={onClear}>
          Clear
        </button>
      </div>
    </>
  );
}
