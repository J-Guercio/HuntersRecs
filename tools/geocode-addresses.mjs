// Re-geocode the workflow's verified street addresses with STRUCTURED Nominatim
// queries (far more accurate than business-name search). Writes tools/addr-geocoded.json.
import { readFileSync, writeFileSync } from 'node:fs';

const enriched = JSON.parse(readFileSync(new URL('./enriched.json', import.meta.url)));
const OKC = { latMin: 35.20, latMax: 35.80, lonMin: -97.85, lonMax: -97.20 };
const inOKC = (lat, lon) => lat >= OKC.latMin && lat <= OKC.latMax && lon >= OKC.lonMin && lon <= OKC.lonMax;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Split "1004 N Hudson Ave, Oklahoma City, OK 73102" into structured parts.
function parse(address) {
  const parts = address.split(',').map((s) => s.trim());
  const street = parts[0] || '';
  const city = parts[1] || 'Oklahoma City';
  let state = 'Oklahoma';
  let postal = '';
  if (parts[2]) {
    const m = parts[2].match(/([A-Za-z]{2})?\s*(\d{5})?/);
    if (m) {
      if (m[1]) state = m[1];
      if (m[2]) postal = m[2];
    }
  }
  return { street, city, state, postal };
}

async function geocode(address) {
  const { street, city, state, postal } = parse(address);
  const qs = new URLSearchParams({
    street,
    city,
    state,
    country: 'USA',
    format: 'json',
    limit: '1',
  });
  if (postal) qs.set('postalcode', postal);
  const url = `https://nominatim.openstreetmap.org/search?${qs.toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'okc-hunters-recs/1.0 (route planner)' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  const lat = parseFloat(data[0].lat);
  const lon = parseFloat(data[0].lon);
  return inOKC(lat, lon) ? { lat: +lat.toFixed(6), lng: +lon.toFixed(6) } : null;
}

const out = [];
for (const p of enriched) {
  let coord = null;
  if (p.address) {
    try {
      coord = await geocode(p.address);
    } catch {
      coord = null;
    }
    await sleep(1100);
  }
  out.push({ name: p.name, address: p.address, addrLat: coord?.lat ?? null, addrLng: coord?.lng ?? null });
  console.log(`${coord ? 'OK  ' : 'MISS'} ${p.name}`);
}

writeFileSync(new URL('./addr-geocoded.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`\nAddress geocode: ${out.filter((o) => o.addrLat).length}/${out.length} resolved.`);
