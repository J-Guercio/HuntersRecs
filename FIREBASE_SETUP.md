# Firebase setup — login wall + private cloud data

The app gates access behind **Google sign-in** and stores each allowed user's
tracking data (visited / priority / notes / ratings) privately in **Firestore**.
Until you complete this, the app runs in open "local mode" (no login, data in the
browser). Setting the env vars turns the gate on.

Estimated time: ~10 minutes.

---

## 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> → **Add project**. Name it (e.g. `hunters-recs`). Google Analytics is optional (you can skip it).

## 2. Turn on Google sign-in
1. In the project, left nav → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Add new provider → Google → Enable**.
3. Pick a support email, **Save**.
4. Leave **only Google** enabled (don't add Email/Password, Anonymous, etc.). The security rules already require a Google sign-in, but keeping other providers off removes any doubt.

## 3. Create the Firestore database
1. Left nav → **Build → Firestore Database → Create database**.
2. Choose a location (e.g. `nam5` / us-central). Start in **Production mode** (we'll paste rules next).

## 4. Paste the security rules
1. Firestore → **Rules** tab.
2. Replace everything with the contents of [`firestore.rules`](firestore.rules) in this repo.
3. **Publish**.

> These rules are the real gate: a user can only read/write their own data, and only if their email is on the allowlist.

## 5. Add the allowlist (who's allowed in)
1. Firestore → **Data** tab → **Start collection** → Collection ID: `allowlist`.
2. For each allowed person, add a **document** whose **Document ID is their Google email, in lowercase** (e.g. `josephcguercio@gmail.com`).
   - The document can be empty — only its ID matters. (Tip: add a field like `name: "Joe"` just so it's not blank.)
3. Repeat **Add document** for every person. To revoke access later, delete their doc.

## 6. Register a Web app and grab the config
1. Project **Settings** (gear icon, top-left) → **General** → scroll to **Your apps** → click the **Web** icon (`</>`).
2. Nickname it (e.g. `web`), **Register app** (skip Hosting).
3. Copy the `firebaseConfig` values into your env vars (next step).

## 7. Set the environment variables
**Local dev** — create a file named `.env.local` in the project root (it's git-ignored) using [`.env.example`](.env.example) as a template:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=hunters-recs.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=hunters-recs
VITE_FIREBASE_STORAGE_BUCKET=hunters-recs.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
```

Restart `npm run dev` after creating it.

**Vercel** — Project → **Settings → Environment Variables** → add each `VITE_FIREBASE_*` key/value (Production + Preview), then **redeploy**.

## 8. Authorize your domains for sign-in
The Google popup only works on allowed domains.
1. Authentication → **Settings → Authorized domains**.
2. `localhost` is there by default. **Add domain** for your live site, e.g. `hunters-recs.vercel.app` (and any custom domain).

---

## Done — how it behaves
- **Not signed in** → login wall.
- **Signed in + on the allowlist** → full app; data syncs to `users/{your-uid}` and follows you across devices.
- **Signed in but not allowlisted** → "not on the guest list" screen.
- Your existing local progress (from before sign-in) is migrated into the cloud the first time you sign in.

## Troubleshooting
- **Popup closes / "unauthorized domain"** → finish step 8 for that exact domain.
- **Stuck on "not on the guest list"** → the allowlist doc ID must exactly match your Google email in **lowercase**; re-check step 5.
- **Login wall never appears (still open)** → env vars not loaded; confirm `.env.local` exists (local) or the vars are set + redeployed (Vercel). All three of API key, project ID, and app ID are required.
- **`Missing or insufficient permissions`** in console → rules not published (step 4) or email not allowlisted (step 5).
