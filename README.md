# Marsh Raid

A top-down PvE extraction shooter with ducks. Duckov's simplicity, Tarkov's tension, Zombs-Royale-style flat graphics.

The whole game is one standalone HTML file: **[`dist/index.html`](dist/index.html)**. Open it in any browser to play; the same file is wrapped for macOS (Electron), Android and iOS (Capacitor).

## Play

- **Hideout**: stash, loadout, trader (Old Mallard), quests from four NPCs, deploy.
- **Raid**: search containers, kill or avoid scavs, reach an open extract and stand in it for 6 seconds. Die or time out and you lose everything you brought.
- **Suspense**: flashlight cone with real occlusion, tiny ambient glow, no hit markers, no enemy health bars, no exact mag count (check it with `C`), near-miss flinches, footsteps and gunshot rings for what you can't see. The flashlight lets scavs see you from much farther — turn it off (`F`) to sneak.
- **Progression**: XP levels, quest chains that pay money, items and trader unlocks, three maps of increasing difficulty with a boss on the hardest.

Controls (desktop): `WASD` move · mouse aim · click fire · `R` reload · `C` check mag · `E` search / open · `Q` swap · `F` flashlight · `M` map · `Tab` inventory · `Shift` sprint · `Esc` pause.
Touch: left stick move, right stick aim (push far to fire), buttons for reload / swap / inventory / interact / check mag, flashlight and map buttons top-right.

## Repo layout

```
src/            game source (plain JS, concatenated in filename order) + index.template.html
build.js        builds src -> dist/index.html (single standalone file, committed)
dist/index.html THE GAME. Always rebuilt and committed; open it anywhere.
electron/       macOS wrapper (Electron)
android/        Capacitor Android project
ios/            Capacitor iOS project
assets/         source icon (icon.png) used to generate platform icons
```

## Build

Requirements: Node 20+, and for Android a JDK 21 plus the Android SDK (platform 36). iOS needs a Mac with Xcode.

```bash
npm install
npm run build          # -> dist/index.html
npm run serve          # local server on :8765 for the browser version
npm run start          # run the Electron app from source
npm run mac            # macOS .dmg / .zip into release/
npm run android:apk    # debug APK into release/ (needs JAVA_HOME + ANDROID_HOME)
npm run ios:open       # sync and open the Xcode project
```

Android env on this Mac (Homebrew):

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
```

Icons: edit `assets/icon.png` then `npx capacitor-assets generate --android --ios`.

## iOS release

See [`docs/IOS_BUILD_PROMPT.md`](docs/IOS_BUILD_PROMPT.md): a prompt to paste into Claude Code on a Mac with Xcode. It clones (or forks) this repo, builds the iOS app, and attaches the result to a GitHub release.

## Design notes

- Vision is a raycast polygon (160 rays in the cone, 72 around the player) carved out of a darkness layer; walls and tree canopies occlude.
- Enemies have patrol / alert / search / chase states, hear gunshots and sprinting, path with A* on the tile grid, and shoot in bursts with reaction delay.
- Maps are procedurally generated per raid from a seed: terrain noise, two roads, walled buildings with doors and interior walls, fences, trees, containers, three edge extracts (the farthest is always open; the others have timed windows).
- Audio is fully procedural (WebAudio), spatialised by distance and pan. No asset files.
- Save data lives in `localStorage` under `marshraid_save_v1`.
