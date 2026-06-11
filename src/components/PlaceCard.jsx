import { useState } from 'react';
import { colorFor, iconFor } from '../lib/categories.js';
import { googleMapsPlaceUrl } from '../lib/geo.js';

export default function PlaceCard({ place, track, selected, onToggleSelect, onUpdate, onToggleVisited, onTogglePriority, onFocus }) {
  const [showNote, setShowNote] = useState(Boolean(track.note));

  return (
    <div className={`card ${selected ? 'sel' : ''} ${track.visited ? 'visited' : ''}`}>
      <div className="row1">
        <span className="dot" style={{ background: colorFor(place.category) }} />
        <h4 onClick={onFocus} style={{ cursor: 'pointer' }} title="Show on map">
          <span className={track.visited ? 'strike' : ''}>{place.name}</span>
        </h4>
        {track.priority && <span title="Priority" className="star">★</span>}
        <button
          className="addbtn"
          onClick={onToggleSelect}
          title={selected ? 'Remove from route' : 'Add to route'}
        >
          {selected ? '− Route' : '+ Route'}
        </button>
      </div>

      <div className="sub">
        {iconFor(place.category)} {place.category} · {place.district}
        {place.priceTier ? ` · ${place.priceTier}` : ''}
      </div>
      {place.vibe && <div className="vibe">{place.vibe}</div>}

      <div className="actions">
        <button
          className={`iconbtn ${track.visited ? 'on' : ''}`}
          onClick={onToggleVisited}
          title={track.visited ? 'Mark not visited' : 'Mark visited'}
        >
          {track.visited ? '✅' : '⬜'}
        </button>
        <button
          className={`iconbtn ${track.priority ? 'on' : ''}`}
          onClick={onTogglePriority}
          title="Toggle priority"
        >
          <span className={track.priority ? 'star' : ''}>★</span>
        </button>

        <span className="stars" title="Your rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className={n <= track.rating ? 'lit' : ''}
              onClick={() => onUpdate({ rating: n === track.rating ? 0 : n })}
            >
              ★
            </button>
          ))}
        </span>

        <button className="iconbtn" onClick={() => setShowNote((s) => !s)} title="Note">
          📝
        </button>
        <a className="iconbtn" href={googleMapsPlaceUrl(place)} target="_blank" rel="noreferrer" title="Open in Google Maps">
          ↗
        </a>
      </div>

      {showNote && (
        <div className="note-row">
          <textarea
            placeholder="Notes — e.g. 'get the croissant', 'closed Mondays'…"
            value={track.note}
            onChange={(e) => onUpdate({ note: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
