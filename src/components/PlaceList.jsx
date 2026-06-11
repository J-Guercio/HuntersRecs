import { useMemo } from 'react';
import PlaceCard from './PlaceCard.jsx';
import { spread } from '../lib/geo.js';

// Group visible places by district, ordered by group size (biggest combos first).
function groupByDistrict(places) {
  const map = new Map();
  for (const p of places) {
    if (!map.has(p.district)) map.set(p.district, []);
    map.get(p.district).push(p);
  }
  return [...map.entries()]
    .map(([district, items]) => ({ district, items, walkMiles: spread(items) }))
    .sort((a, b) => b.items.length - a.items.length || a.district.localeCompare(b.district));
}

export default function PlaceList({
  places,
  tracking,
  selectedIds,
  get,
  onToggleSelect,
  onUpdate,
  onToggleVisited,
  onTogglePriority,
  onFocus,
  onPlanCombo,
}) {
  const groups = useMemo(() => groupByDistrict(places), [places]);

  if (!places.length) {
    return <div className="route-empty">No places match these filters.</div>;
  }

  return (
    <>
      {groups.map(({ district, items, walkMiles }) => {
        const walkable = items.length > 1 && walkMiles <= 0.5;
        return (
          <div key={district}>
            <div className="group-head">
              <h3>{district}</h3>
              <span className="meta">
                {items.length} {items.length === 1 ? 'spot' : 'spots'}
                {items.length > 1 && (
                  <>
                    {' · '}
                    {walkable ? (
                      <span className="walk">walkable 🚶</span>
                    ) : (
                      <>~{walkMiles.toFixed(1)} mi across</>
                    )}
                  </>
                )}
              </span>
              {items.length > 1 && (
                <button className="ghost addbtn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => onPlanCombo(items)}>
                  Plan combo →
                </button>
              )}
            </div>
            {items.map((p) => (
              <PlaceCard
                key={p.id}
                place={p}
                track={get(p.id)}
                selected={selectedIds.has(p.id)}
                onToggleSelect={() => onToggleSelect(p.id)}
                onUpdate={(patch) => onUpdate(p.id, patch)}
                onToggleVisited={() => onToggleVisited(p.id)}
                onTogglePriority={() => onTogglePriority(p.id)}
                onFocus={() => onFocus(p)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
