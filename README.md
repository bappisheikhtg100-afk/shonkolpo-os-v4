# সংকল্প OS — Offline Android App (Capacitor)

100% offline. No CDN, no network calls. All libraries (Tailwind, React, Chart.js, Lucide) and all
fonts (Hind Siliguri, Inter, Baloo Da 2) are bundled inside `www/`. The JSX is pre-compiled into
`www/app.js`, so Babel is not needed at runtime (much faster startup).

## Get the APK (no local setup needed)

1. Create a new GitHub repository.
2. Upload every file in this zip to the repo root (keep the folder structure, including `.github/`).
3. Go to the **Actions** tab → the "Build Android APK" workflow runs automatically on push.
4. When it finishes, open the run → **Artifacts** → download `sonkolpo-os-apk`.
   It contains `app-debug.apk` (installable directly) and an unsigned release APK.

> If Actions asks for permission the first time, click "I understand my workflows, go ahead and enable them".

## Local build (optional)

```bash
npm install
npx cap add android
npx capacitor-assets generate --android
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Structure

- `www/index.html` — app shell (all links rewritten to local files)
- `www/app.js` — pre-compiled application code
- `www/native.js` — Android native glue (back button, status bar, haptics, share, notifications)
- `www/vendor/`, `www/fonts/` — bundled libraries and fonts
- `resources/` — source icon & splash, used to generate all Android densities
- `capacitor.config.json` — app id `com.bappi.sonkolpo`, app name সংকল্প OS

## Native features included

Hardware back button handling, status bar theming (follows dark mode), splash screen,
haptic feedback, native share, file save to Documents, local notifications, keyboard resize,
and Preferences storage — all available offline.

Data still lives in the WebView's localStorage, which persists on-device.

## v4 updates
- New minimal green theme, lighter typography, bottom navigation bar (Home, Study, Cards, Tasks, More)
- Redesigned flashcards (tap-to-reveal list + full-screen study mode)
- Bangla typing fixed (Android keyboard input capture disabled)
- JSON export saves to `Documents/Sonkolpo/` in the phone's file manager and opens the share sheet
- Alarms, schedule and task reminders are scheduled as system notifications, so they fire even when the app is closed
