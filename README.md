# 📍 OKC Hunters Recs — Route Planner

A personal map + tracker for the OKC must-visit list. See every spot on a map,
mark them off as you go, rate them, jot notes, and let the app **group nearby
places into one-trip "combos"** and **build the shortest route** through any set
you pick — then open it straight in Google Maps for navigation.

No API keys. No billing. No backend. Static React app — deploys to Vercel in a click.

## Features

- **Map of all 58 spots**, color-coded by category (Coffee, Food, Bar/Club, Shopping, Entertainment, Grocery).
- **Tracking** that persists in your browser (localStorage):
  - ✅ Visited / not visited — with an overall progress bar
  - ★ Priority (want-to-go-most)
  - ⭐ 1–5 star rating after you go
  - 📝 Free-text notes per place
- **Neighborhood combos** — places auto-grouped by OKC district (Plaza, Midtown,
  Automobile Alley, Film Row, Uptown 23rd, Western Ave…), each flagged
  *walkable 🚶* when they're tight together. One click plans the whole combo.
- **Optimal routing** — pick any places (or a whole combo) and the app computes the
  shortest visiting order (nearest-neighbor + 2-opt), with total miles and an
  estimated drive/walk time, plus per-leg distances.
- **Open in Google Maps** — every place links out, and a full route exports as a
  Google Maps directions link for real turn-by-turn navigation.
- **Backup / restore** — export your tracking to a JSON file and re-import on any device.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Build a production bundle:

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build
```

## Deploy to Vercel

This is a standard Vite app, so Vercel auto-detects everything.

**Option A — dashboard (easiest):**
1. Push this folder to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework preset: **Vite** (auto-detected). Build: `npm run build`. Output: `dist`.
4. Deploy. Done.

**Option B — CLI:**
```bash
npm i -g vercel
vercel            # follow prompts; accept the Vite defaults
vercel --prod     # promote to production
```

No environment variables are needed for the basic (open) app. To turn on the
**Google login wall + private cloud sync**, set the `VITE_FIREBASE_*` variables —
see **Access control** below.

## Access control (optional but recommended)

The app can gate access to an allowlist of Google accounts and sync each user's
tracking data privately to Firestore. Without Firebase configured it runs in
open "local mode" (no login, data stays in the browser).

To enable it, follow **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** — create a Firebase
project, enable Google sign-in, paste [`firestore.rules`](firestore.rules), add
allowed emails to an `allowlist` collection, and set the `VITE_FIREBASE_*` env
vars (locally in `.env.local`, and in Vercel's project settings). Once set, the
login wall and cloud sync activate automatically.

## The data

The list of places lives in [`src/data/places.js`](src/data/places.js) and was built by:
1. Parsing your coworker's list (`doc1.txt`).
2. Verifying each business via web research (current address, neighborhood, category, vibe).
3. Geocoding the verified street addresses against OpenStreetMap.

To regenerate after editing the source list, the pipeline scripts are in [`tools/`](tools/):

```bash
node tools/geocode.mjs            # name-based geocode (seed)
# (research step produced tools/enriched.json)
node tools/geocode-addresses.mjs  # structured address geocode
node tools/build-data.mjs         # merge -> src/data/places.js
```

If any pin is slightly off, just fix its `lat`/`lng` in `src/data/places.js`.

## Tech

React 18 · Vite · React-Leaflet + OpenStreetMap (CARTO dark tiles) · all routing
math runs client-side. Tracking state is local to your browser.
