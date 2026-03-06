# NetHack 3D

Play in browser: https://jamesiv4.github.io/nethack-3d/

NetHack 3D lets you play classic NetHack in a fully interactive 3D dungeon, in your browser, phone or desktop PC.

## Gameplay video link:

[![NetHack 3D](https://img.youtube.com/vi/LNk3G-lV77k/0.jpg)](https://www.youtube.com/watch?v=LNk3G-lV77k)

## Screenshots (outdated)

| Combat (Gnomish Mines)                                                                                                                                                                                                   | Enhanced Combat Visuals (Tile shake, damage numbers, blood)                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [![Combat in the Gnomish Mines](https://github.com/JamesIV4/nethack-3d/blob/main/docs/screenshots/combat-gnomish-mines.png)](https://github.com/JamesIV4/nethack-3d/blob/main/docs/screenshots/combat-gnomish-mines.png) | [![Blood effects during combat](docs/screenshots/blood-effects-combat.png)](docs/screenshots/blood-effects-combat.png) |
| Attributes                                                                                                                                                                                                               | Inventory                                                                                                              |
| [![Attributes panel](https://github.com/JamesIV4/nethack-3d/blob/main/docs/screenshots/attributes-panel.png)](https://github.com/JamesIV4/nethack-3d/blob/main/docs/screenshots/attributes-panel.png)                    | [![Inventory panel](docs/screenshots/inventory-panel.png)](docs/screenshots/inventory-panel.png)                       |

## Current Features

- Play NetHack in a 3D dungeon view while keeping core game rules and depth.
- Two play styles: classic top-down and first-person (FPS) mode.
- Minimap for full-level awareness, with viewport box and drag-to-center camera navigation.
- Camera panning and rotation.
- Crisp ASCII monsters and items.
- Built-in graphical tilesets: Absurdly Evil, DawnHack, NetHack Modern, Nevanda, and Vanilla NetHack Tiles.
- Upload and manage your own custom tilesets directly in-game.
- Per-tileset background cleanup controls (tile selection, chroma key, and removal mode tuning).
- Dynamic darkness and lighting around your hero.
- Combat feedback effects (screen-space and tile effects)
- Optional floating damage/heal numbers and blood mist combat particles.
- Full HUD with level, health, power, stats, armor, gold, hunger, experience, time, and dungeon depth.
- Live message log plus on-screen message popups
- Full mobile touch support for NetHack prompts: yes/no, directional actions, text entry, and tile targeting/look mode.
- Beautiful menus: item category headers, keyboard tips, multi-pickup selection, and menu paging.
- Fast character start: random hero or manual setup (name, role, race, gender, alignment).
- Extended command support with `#` so advanced playstyles are available, with all commands available via buttons on mobile.
- Desktop-friendly controls: keyboard-first with mouse support for map interaction and camera control.
- Mobile-friendly controls: tap/swipe movement, quick actions, extended command sheet, mobile log view, and FPS touch-look/touch-run gestures.
- Inventory context actions for common item interactions without typing command sequences.
- Adjustable client options including FPS FOV, look sensitivity, inverted look, antialiasing, and minimap visibility.

## Supported Targets

- Web browser
- Meta Quest Browser via WebXR
- GitHub Pages hosted web build
- Windows desktop via Electron
- iPhone / iPad via Safari `Add to Home Screen`

## Common Setup

Run this once after cloning the repo:

1. Install a current Node.js release.
2. `npm i`

The helper scripts below already call the platform-specific build steps they need. In most cases you do not need to run `build:electron` directly unless you want just the intermediate web bundle.

## Web Browser / Local Development

Use this for normal local development in a desktop browser.

First-time setup:

1. `npm i`

Development:

1. `npm run dev`
2. Open `http://localhost:5173/`

Production bundle:

1. `npm run build`
2. `npm run preview`

Output:

- `dist/`

Optional helpers:

- `npm run dev:isolated` - Start the dev server with cross-origin isolation headers enabled.
- `npm run preview:isolated` - Preview the production build with cross-origin isolation headers enabled.

## Meta Quest 3 / Quest Browser (WebXR)

To play in VR, open the [Play in browser](https://jamesiv4.github.io/nethack-3d/) link in your VR headset's browser, enable the in-game VR option, and use `Enter VR`.

Local VR development first-time setup:

1. `npm i`
2. Install Android Platform Tools so the `adb` command is available.
3. Enable Developer Mode on the headset.

Localhost development from a Quest connected to your PC:

1. Connect the Quest to your PC over USB.
2. Run `npm run vr:quest:dev`.
3. In Quest Browser, open `http://localhost:5173/`.
4. In the app, make sure the VR option is enabled, then use `Enter VR`.
5. Go to chrome://inspect/#devices on your PC to debug the app.

What `npm run vr:quest:dev` does for you:

- Verifies `adb` is installed.
- Verifies the headset is connected over USB.
- Runs `adb reverse tcp:5173 tcp:5173`.
- Starts the local Vite dev server on port `5173`.

Manual fallback if you want to run the steps yourself:

1. Start the local dev server on the PC with `npm run dev`.
2. Verify ADB can see the headset with `adb devices`.
3. Forward the Vite port into the headset with `adb reverse tcp:5173 tcp:5173`.
4. In Quest Browser, open `http://localhost:5173/`.

Notes:

- `http://localhost:5173/` in the headset only works after `adb reverse`. On the Quest, `localhost` normally refers to the headset itself, not your PC.
- Plain `http://<your-pc-ip>:5173/` is not a secure context, so WebXR may not be available there.
- If VR still shows unavailable in Quest Browser, make sure Desktop mode is off for this tab and reload the page.
- If the USB dev flow is inconvenient, use the GitHub Pages build below. That gives Quest Browser an HTTPS URL, which is the normal hosted WebXR path.
- `npm run vr:quest:dev:isolated` does the same setup but starts the dev server with cross-origin isolation headers enabled.

Hosted Quest Browser flow:

1. Build the hosted bundle with `npm run build:github-pages`, or push to `main` to let GitHub Actions deploy it.
2. Open `https://jamesiv4.github.io/nethack-3d/` in Quest Browser.
3. In the app, make sure the VR option is enabled, then use `Enter VR`.

## GitHub Pages Hosted Web Build

Use this for the public hosted browser build at `https://jamesiv4.github.io/nethack-3d/`.

First-time setup:

1. `npm i`
2. In GitHub repository settings, set `Pages -> Source` to `GitHub Actions`.

Local build script:

1. `npm run build:github-pages`

Deploy:

1. Push to `main`, or run `.github/workflows/deploy-gh-pages.yml` manually.
2. The workflow builds `dist/` and deploys it to GitHub Pages.

## Windows Desktop (Electron)

Use this for the native Windows desktop build.

First-time setup:

1. `npm i`

Development:

1. `npm run electron:dev`

Production builds:

1. `npm run electron:dist:win` - NSIS installer build
2. `npm run electron:dist:win:portable` - portable `.exe`
3. `npm run electron:pack:win` - unpacked app directory

Output:

- `release/`

Optional helper:

- `npm run electron:dev:isolated` - Electron dev mode with cross-origin isolation enabled.

## iPhone / iPad

There is no native iOS packaging flow in this repo.

Use the hosted web build instead:

1. Open `https://jamesiv4.github.io/nethack-3d/` in Safari.
2. Tap `Share`.
3. Tap `Add to Home Screen`.
4. Launch it from your Home Screen for the installed web app experience.

## Utility Scripts

- `npm run glyphs:generate` - Regenerate glyph catalog from runtime artifacts.
- `npm run glyphs:check` - Verify checked-in glyph catalog is up to date.

## Architecture

- Main app bootstrap/debug helpers: `src/app.ts`
- React entry: `src/main.tsx`
- React UI shell: `src/ui/App.tsx`
- 3D engine and client-side interaction: `src/game/Nethack3DEngine.ts`
- Glyph catalog + behavior rules: `src/game/glyphs/*`
- Runtime worker bridge: `src/runtime/WorkerRuntimeBridge.ts`
- Worker runtime host: `src/runtime/runtime-worker.ts`
- NetHack callback adapter/state machine: `src/runtime/LocalNetHackRuntime.ts`
