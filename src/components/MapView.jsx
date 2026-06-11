import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { colorFor, iconFor } from '../lib/categories.js';
import { googleMapsPlaceUrl } from '../lib/geo.js';

// Build a teardrop divIcon colored by category, optionally numbered (route order).
function pinIcon(place, { visited, selected, number }) {
  const bg = colorFor(place.category);
  const label = number != null ? number : iconFor(place.category);
  const cls = ['pin', visited ? 'visited' : '', selected ? 'sel' : ''].filter(Boolean).join(' ');
  const size = number != null ? 30 : 26;
  return L.divIcon({
    className: '',
    html: `<div class="${cls}" style="width:${size}px;height:${size}px;background:${bg}"><span>${label}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(b, { padding: [50, 50], maxZoom: 15 });
  }, [points, map]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 16, { duration: 0.6 });
  }, [target, map]);
  return null;
}

export default function MapView({
  places,
  visibleIds,
  tracking,
  selectedIds,
  routeOrder,
  focusTarget,
  onToggleSelect,
  theme = 'light',
}) {
  const tileUrl =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const visible = useMemo(
    () => places.filter((p) => visibleIds.has(p.id)),
    [places, visibleIds]
  );

  // Map place id -> route stop number (1-based) when a route is active.
  const numberFor = useMemo(() => {
    const m = new Map();
    routeOrder?.forEach((id, i) => m.set(id, i + 1));
    return m;
  }, [routeOrder]);

  const routeLine = useMemo(() => {
    if (!routeOrder?.length) return [];
    const byId = new Map(places.map((p) => [p.id, p]));
    return routeOrder.map((id) => byId.get(id)).filter(Boolean).map((p) => [p.lat, p.lng]);
  }, [routeOrder, places]);

  const fitPoints = routeLine.length ? routeOrder.map((id) => places.find((p) => p.id === id)).filter(Boolean) : visible;

  return (
    <MapContainer center={[35.472, -97.523]} zoom={13} scrollWheelZoom zoomControl={false}>
      <TileLayer
        key={theme}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={tileUrl}
      />
      <FitBounds points={fitPoints} />
      <FlyTo target={focusTarget} />

      {routeLine.length > 1 && (
        <Polyline positions={routeLine} pathOptions={{ color: '#38bdf8', weight: 3, opacity: 0.9, dashArray: '1 8', lineCap: 'round' }} />
      )}

      {visible.map((p) => {
        const t = tracking[p.id] || {};
        const number = numberFor.get(p.id);
        return (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={pinIcon(p, { visited: t.visited, selected: selectedIds.has(p.id), number })}
          >
            <Popup>
              <div className="popup-card">
                <h4>{p.name}</h4>
                <p className="pc-sub">
                  {iconFor(p.category)} {p.category} · {p.district}
                  {p.priceTier ? ` · ${p.priceTier}` : ''}
                </p>
                {p.vibe && <p style={{ margin: '0 0 8px', fontSize: 12 }}>{p.vibe}</p>}
                <div className="pc-actions">
                  <button onClick={() => onToggleSelect(p.id)}>
                    {selectedIds.has(p.id) ? '− Remove from route' : '+ Add to route'}
                  </button>
                  <a href={googleMapsPlaceUrl(p)} target="_blank" rel="noreferrer">
                    Maps ↗
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
