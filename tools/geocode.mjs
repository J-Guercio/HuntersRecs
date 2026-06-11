// One-off geocoder: resolves each place to lat/lng via OpenStreetMap Nominatim.
// Respects the 1 req/sec usage policy. Writes tools/geocoded.json.
import { writeFileSync } from 'node:fs';

// category is a best-guess seed; the enrichment pass refines it.
const PLACES = [
  ['Perets Dessert & Coffee Bar', 'Coffee'],
  ['Clarity Coffee', 'Coffee'],
  ["Hall's Pizza Kitchen", 'Food'],
  ['Harvey Bakery & Kitchen', 'Food'],
  ['Bar Arbolada', 'Food'],
  ['Bourbon St Cafe', 'Food'],
  ['Bar Cicchetti', 'Food'],
  ['Kitchen No 324', 'Food'],
  ['Maht', 'Food'],
  ['Birdies', 'Food'],
  ['The Red Cup', 'Food'],
  ['The Bradford House', 'Food'],
  ['Cafe Kacao', 'Food'],
  ['Cafe Antigua', 'Food'],
  ['Ma Der Lao Kitchen', 'Food'],
  ["R&J Lounge and Supper Club", 'Bar/Club'],
  ['The Study', 'Bar/Club'],
  ['OK Cider', 'Bar/Club'],
  ["Duckie's Woodfire", 'Bar/Club'],
  ['Social Capital', 'Bar/Club'],
  ['Lamp Post Lounge', 'Bar/Club'],
  ['Lunar Lounge', 'Bar/Club'],
  ["Michael Murphy's Dueling Piano Bar", 'Bar/Club'],
  ['Commonplace Books', 'Shopping'],
  ["Dead People's Stuff", 'Shopping'],
  ['Orange Peel Vintage', 'Shopping'],
  ['Room 3 Vintage Mall', 'Shopping'],
  ['The Jones Assembly', 'Entertainment'],
  ['Beer City Music Hall', 'Entertainment'],
  ["Trader Joe's", 'Grocery'],
  ['Prelude Coffee Roasters', 'Coffee'],
  ['Prairie OKC', 'Shopping'],
  ['Eote Coffee', 'Coffee'],
  ['Parlor OKC', 'Food'],
  ['Plenty Mercantile', 'Shopping'],
  ['Coffee Slingers Roasters', 'Coffee'],
  ['The Collective Kitchens', 'Food'],
  ["McNellie's Public House OKC", 'Bar/Club'],
  ["Cookie's on Western", 'Bar/Club'],
  ['Egg and CaPhe', 'Food'],
  ['Ser OKC', 'Bar/Club'],
  ['Guyutes', 'Food'],
  ['Bungalow 23', 'Bar/Club'],
  ['Eleven Eleven OKC', 'Food'],
  ['Bunker Club', 'Bar/Club'],
  ['Pizzeria Gusto', 'Food'],
  ['The Wedge Pizzeria', 'Food'],
  ['Yours Truly OKC', 'Food'],
  ['Guestroom Records', 'Shopping'],
  ['Sushi Neko', 'Food'],
  ['Tous les Jours OKC', 'Food'],
  ['New State Burger', 'Food'],
  ['Dig It Boutique', 'Shopping'],
  ["Bad Granny's Bazaar", 'Shopping'],
  ['Bar Sen', 'Bar/Club'],
  ['OKC Farmers Public Market', 'Shopping'],
  ['Scissortail Park', 'Entertainment'],
  ["Zorba's Mediterranean", 'Food'],
];

const OKC = { latMin: 35.30, latMax: 35.70, lonMin: -97.75, lonMax: -97.30 };
const inOKC = (lat, lon) => lat >= OKC.latMin && lat <= OKC.latMax && lon >= OKC.lonMin && lon <= OKC.lonMax;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=3&countrycodes=us`;
  const res = await fetch(url, { headers: { 'User-Agent': 'okc-hunters-recs/1.0 (personal route planner)' } });
  if (!res.ok) return [];
  return res.json();
}

function pickBest(results) {
  for (const r of results) {
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon);
    if (inOKC(lat, lon)) return { lat, lon, display: r.display_name };
  }
  return null;
}

const out = [];
for (const [name, category] of PLACES) {
  let hit = null;
  const attempts = [
    `${name}, Oklahoma City, OK`,
    `${name}, OKC`,
    `${name}, Oklahoma`,
  ];
  for (const a of attempts) {
    const results = await query(a);
    hit = pickBest(results);
    await sleep(1100); // Nominatim: max 1 req/sec
    if (hit) break;
  }
  if (hit) {
    out.push({ name, category, lat: +hit.lat.toFixed(6), lng: +hit.lon.toFixed(6), osm: hit.display });
    console.log(`OK   ${name}  ->  ${hit.lat},${hit.lon}`);
  } else {
    out.push({ name, category, lat: null, lng: null, osm: null });
    console.log(`MISS ${name}`);
  }
}

writeFileSync(new URL('./geocoded.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`\nDone. ${out.filter((o) => o.lat).length}/${out.length} geocoded.`);
