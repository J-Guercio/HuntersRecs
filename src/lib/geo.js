// Geospatial helpers: distances, neighborhood grouping, and route optimization.
// Everything runs client-side — no API calls, no keys.

const R = 3958.8; // Earth radius in miles
const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in miles between two {lat,lng} points. */
export function haversine(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Total length (miles) of an ordered list of points. */
export function pathLength(points) {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += haversine(points[i - 1], points[i]);
  return sum;
}

/**
 * Optimize visiting order (open path TSP) via nearest-neighbor + 2-opt.
 * @param {Array<{lat,lng}>} stops
 * @param {number} startIndex index of fixed start, or -1 to let it choose
 * @returns {{order:number[], miles:number}} order = indices into `stops`
 */
export function optimizeRoute(stops, startIndex = -1) {
  const n = stops.length;
  if (n <= 1) return { order: stops.map((_, i) => i), miles: 0 };

  const d = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : haversine(stops[i], stops[j])))
  );

  const buildNN = (start) => {
    const visited = new Array(n).fill(false);
    const order = [start];
    visited[start] = true;
    for (let k = 1; k < n; k++) {
      const last = order[order.length - 1];
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < n; j++) {
        if (!visited[j] && d[last][j] < bestD) {
          bestD = d[last][j];
          best = j;
        }
      }
      order.push(best);
      visited[best] = true;
    }
    return order;
  };

  const len = (order) => {
    let s = 0;
    for (let i = 1; i < order.length; i++) s += d[order[i - 1]][order[i]];
    return s;
  };

  // Try a few starts (or the fixed one) and keep the best nearest-neighbor tour.
  const starts = startIndex >= 0 ? [startIndex] : Array.from({ length: n }, (_, i) => i);
  let best = null;
  let bestLen = Infinity;
  for (const s of starts) {
    const o = buildNN(s);
    const l = len(o);
    if (l < bestLen) {
      bestLen = l;
      best = o;
    }
  }

  // 2-opt refinement. Keep index 0 fixed when a start was requested.
  const lockStart = startIndex >= 0;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = lockStart ? 1 : 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const a = best[i - 1 >= 0 ? i - 1 : 0];
        // delta of reversing segment [i, k]
        const before =
          (i > 0 ? d[best[i - 1]][best[i]] : 0) +
          (k < best.length - 1 ? d[best[k]][best[k + 1]] : 0);
        const after =
          (i > 0 ? d[best[i - 1]][best[k]] : 0) +
          (k < best.length - 1 ? d[best[i]][best[k + 1]] : 0);
        if (after + 1e-9 < before) {
          const seg = best.slice(i, k + 1).reverse();
          best = [...best.slice(0, i), ...seg, ...best.slice(k + 1)];
          improved = true;
        }
        void a;
      }
    }
  }

  return { order: best, miles: len(best) };
}

/**
 * Group places into proximity clusters (DBSCAN-style single-linkage).
 * Used as a fallback when explicit districts aren't set.
 * @param {Array<{lat,lng}>} places
 * @param {number} epsMiles neighbor radius
 * @returns {number[][]} arrays of indices
 */
export function clusterByProximity(places, epsMiles = 0.45) {
  const n = places.length;
  const cluster = new Array(n).fill(-1);
  let cid = 0;
  const neighbors = (i) => {
    const out = [];
    for (let j = 0; j < n; j++) if (i !== j && haversine(places[i], places[j]) <= epsMiles) out.push(j);
    return out;
  };
  for (let i = 0; i < n; i++) {
    if (cluster[i] !== -1) continue;
    const queue = [i];
    cluster[i] = cid;
    while (queue.length) {
      const cur = queue.pop();
      for (const nb of neighbors(cur)) {
        if (cluster[nb] === -1) {
          cluster[nb] = cid;
          queue.push(nb);
        }
      }
    }
    cid++;
  }
  const groups = Array.from({ length: cid }, () => []);
  cluster.forEach((c, idx) => groups[c].push(idx));
  return groups;
}

/** Centroid {lat,lng} of a set of points. */
export function centroid(points) {
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

/** Max pairwise distance (miles) within a set — used to judge walkability. */
export function spread(points) {
  let max = 0;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) max = Math.max(max, haversine(points[i], points[j]));
  return max;
}

/** Rough walk/drive time estimate from miles. Returns minutes. */
export function estimateMinutes(miles, mode = 'drive') {
  const mph = mode === 'walk' ? 3 : 25; // city-street averages
  return Math.round((miles / mph) * 60);
}

/** Google Maps directions deep-link for an ordered list of stops. */
export function googleMapsRouteUrl(orderedStops, origin) {
  const base = 'https://www.google.com/maps/dir/?api=1';
  const fmt = (p) => `${p.lat},${p.lng}`;
  const dest = orderedStops[orderedStops.length - 1];
  const mids = orderedStops.slice(0, -1);
  const params = new URLSearchParams();
  if (origin) params.set('origin', typeof origin === 'string' ? origin : fmt(origin));
  else if (mids.length) params.set('origin', fmt(mids.shift()));
  params.set('destination', fmt(dest));
  if (mids.length) params.set('waypoints', mids.map(fmt).join('|'));
  params.set('travelmode', 'driving');
  return `${base}&${params.toString()}`;
}

/** Google Maps deep-link to a single place (by name for best match). */
export function googleMapsPlaceUrl(place) {
  const q = encodeURIComponent(`${place.name}, Oklahoma City, OK`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
