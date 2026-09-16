# 🌱💧 Sipling

A friendly desktop companion that reminds you to drink water. Sipling lives in your
menu bar / system tray and pops a cute animated avatar onto your screen when it's time
to hydrate — with a *"I drank it"* button, snooze, and a daily glass counter.

Cross-platform: **macOS + Windows** (built with Electron).

## Features
- 🚶 **Walk-across buddy** — a persistent, fullscreen, transparent, **click-through**
  overlay (floats above every app, even fullscreen). Your buddy walks in from the screen
  edge, pauses with a speech bubble + buttons, then walks back out. Only the buddy captures
  the mouse; the rest of your screen stays fully usable.
- 🎬 **Your own avatar** — drop an `avatar.mp4` / `.webm` / `.gif` into `assets/`
  (see [assets/README.md](assets/README.md)). Falls back to a bouncing emoji if none.
- ⏰ **Configurable schedule** — reminder interval, active hours (so it stays quiet at night).
- 💧 **Daily goal + counter** — track glasses, celebrate when you hit your goal.
- 😴 **Snooze & auto-dismiss** — never naggy; walks off by itself after 30s.
- 🔔 Optional chime, launch-at-login, and choice of screen corner.
- 🧰 Lives in the menu bar / tray — no dock clutter.
- ⬆️ **Auto-updates** from GitHub Releases (packaged builds).

## Run it (development)
```bash
cd sipling
npm install
npm start
```
Sipling starts in your menu bar. Right-click the tray icon → **Remind me now** to preview,
or **Settings…** to configure.

## Add your avatar
Save your animated avatar as `assets/avatar.mp4` (or `.webm`). That's it — Sipling uses it
automatically on the next reminder. See [assets/README.md](assets/README.md) for tips.

## Build installers
```bash
npm run dist:mac   # -> .dmg  (build on macOS)
npm run dist:win   # -> .exe installer (build on Windows)
```
> Note: build the macOS app on a Mac and the Windows app on Windows (or via CI) for
> best results — Electron installers are platform-specific.

## Build & release (auto-update)
Auto-update pulls from **GitHub Releases** (`manthanmk66/sipling` — change the `build.publish`
block in [package.json](package.json) if your repo differs). To cut a release:
```bash
export GH_TOKEN=<a GitHub token with repo scope>
npm run dist:mac   # or dist:win — builds AND publishes to a draft release
```
`electron-builder` uploads the installer + the update metadata (`latest-mac.yml` / `latest.yml`)
and the macOS `.zip` (required by Squirrel.Mac). Publish the draft release and installed apps
update themselves within 6 hours (or on next launch).

> Auto-update only runs in **packaged** builds — never in `npm start`.

## Project layout
```
src/
  main.js        Electron main process: tray, scheduling, overlay, IPC
  preload.js     Safe bridge to the renderer (contextIsolation)
  store.js       Tiny JSON config store in userData (no deps)
  updater.js     electron-updater wiring (GitHub Releases)
  overlay.html/.css/.js   Fullscreen click-through overlay — the walk-across buddy
  settings.html/.js       The settings window
scripts/
  generate-tray-icon.cjs  Draws the menu-bar template icon (no deps)
assets/          Your avatar + generated icons (see its README)
```

Made with 💧 by Manthan.
