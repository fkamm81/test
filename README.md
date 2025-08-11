
# Parlez Avec Amour — PWA

A delightful, offline-first French learning app you can install on iPhone, Android, or desktop.

## Quick Deploy (pick one)

### Option A — GitHub Pages (free, fast)
1. Create a new repo on GitHub (public is fine).
2. Upload **all files** from this folder (keep the same structure).
3. In the repo: **Settings → Pages → Build and deployment → Source**: select **Deploy from a branch**.
4. Choose **main** as branch and **/ (root)** as folder. Save.
5. Wait 1–2 minutes. Your site appears under **Settings → Pages**.
6. Open that HTTPS URL on your iPhone in **Safari**.

> Tip: If you see a 404, wait a minute and refresh. Add an empty file named `.nojekyll` at the project root to avoid Jekyll quirks.

### Option B — Netlify (drag & drop)
1. Go to netlify.com → Log in → **Sites**.
2. Drag the entire folder onto the Sites page.
3. Netlify gives you an HTTPS URL instantly.
4. Open it on your iPhone in **Safari**.

### Option C — Vercel (upload)
1. Go to vercel.com → New Project.
2. Import the repo or upload the folder.
3. Deploy. Open the HTTPS URL in **Safari** on iPhone.

---

## Install on iPhone (iOS)
1. Open the site in **Safari**.
2. Tap the **Share** button.
3. Tap **Add to Home Screen** → **Add**.
4. Launch from the new Home Screen icon. First run caches files for offline use.

## Update behavior
- When you redeploy new files, the service worker downloads updates in the background.
- Close and reopen the app to apply the newest version.
- To hard-refresh: long‑press the Home Screen icon → **Remove App** (this removes only the PWA shell, not data in Safari). Then reinstall.

## Customize the name & icon
- **App name:** edit `manifest.webmanifest`:
  - `"name"` and `"short_name"` (long and short titles shown during install and on the Home Screen).
- **Home Screen icon:** replace `icons/icon-192.png` and `icons/icon-512.png` with your own PNGs.
  - Recommended: 192×192 and 512×512, square, transparent or solid background.
  - After replacing, redeploy; then on iPhone, remove and re‑add to Home Screen to refresh the icon.

## Customize content
- Words & phrases live in `data.js` (`WORD_PACKS`). Add, remove, or create new packs.
- Styles live in `style.css`. Themes are configured via CSS custom properties and the `data-theme` attribute.

## Files overview
- `index.html` — main page (registers the service worker + links the manifest).
- `style.css` — UI styles and themes.
- `data.js` — word packs (edit here to add more content).
- `app.js` — the app logic (flashcards SRS, quiz, listening, speaking, matching, writing, progress).
- `manifest.webmanifest` — PWA manifest (name, icons, theme color, start URL).
- `sw.js` — service worker for offline caching.
- `icons/` — app icons (replace to personalize).

## Troubleshooting
- **Not showing “Add to Home Screen”?** Make sure the site is served via **HTTPS** and opened in **Safari**. Wait a few seconds after first load.
- **Offline not working on first try:** open the app, let it load for 5–10 seconds (this caches it), then try airplane mode.
- **Microphone/Speaking activity:** works best in Chrome/Edge desktop. iOS support can vary by version.
- **Blank updates / stuck old version:** force‑close and reopen the PWA, or remove and re‑add to Home Screen to clear old cache.

## Privacy
All progress is stored in your browser’s **localStorage** on the device — no servers involved. You can export/import progress from **Settings**.
