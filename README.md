# Diamond Crush

A top-down, grid-based treasure-hunting puzzle adventure for HTML5 Canvas, built from the *Diamond Crush: The Lost Expeditions* game design document. You dig through earth, push boulders, dodge falling rocks, crush snakes and collect every gem, with rewinds, clues and a portrait-first control deck.

This build is the full campaign: **five worlds, 63 stages** (10 main stages, 2 secret stages and a guardian per world, and a 10-stage finale with the Obsidian Hand), all with verified solutions, plus an installable **Android APK**.

## Run it

No build step and no dependencies. Serve the folder with any static server:

```sh
npm start            # node tools/serve.js → http://localhost:8080
npm test             # engine rules + every level's solution replay
```

Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`.

## Controls

| Action | Touch | Keyboard | Gamepad | Classic keypad |
| --- | --- | --- | --- | --- |
| Move (hold to walk) | D-pad, joystick or swipe | Arrows / WASD | D-pad / left stick | 2 4 6 8 |
| Use tool | Tool button, or tap (no-buttons mode) | Space | A | 5 |
| Cycle tool | Tool | Q / E | LB / RB | * / # |
| Rewind one step | Rewind button, or two-finger tap | Z / Backspace | B | 0 |
| Swap explorers | Swap | X / C | X | 9 |
| Rock-fall preview (hold) | Map, or press and hold | M / Tab | Y | 1 |
| Lantern clue | Lantern icon | L | | 7 |
| Pause | Pause icon | Esc / P | Start | 3 |

On-screen buttons are optional: the first launch asks whether you want the control deck, gestures only, or keyboard/gamepad, and the pause menu can hide or show the buttons at any time. Settings can switch the deck between D-pad, floating joystick, a retro phone keypad, or no buttons. They also cover left-handed mirroring, button size and opacity, and the game/deck split (you can drag the divider too). There are toggles for the Retro filter (24 px art with LCD lines), reduced motion, haptics, volumes and the four difficulty modes. On landscape phones the deck moves to the sides.

## What's in this build

**Rules engine** (`src/engine/`, GDD section 3). The engine is deterministic, so the same inputs always give the same result.
- It follows the GDD 3.4 tick order. The world ticks on every hero step and on a 400 ms background clock.
- Gravity works "down the screen". Loose rocks wobble for one tick before they fall. A rock resting on your head is safe; only a falling one hurts.
- Rolling stones roll off round things, trying left first. Chains resolve bottom row first, left to right.
- Boulders need a one-step lean before they move. Rocks pushed into pits or water fill them.
- Tiles: earth, cracked walls (hammer), false walls, spikes (warn, then strike), pressure plates, levers, gates, weak floors, four key/door colours with shapes, checkpoint idols, the exit gate with a gem quota, and secret exits.
- Enemies: temple snakes, scarabs that follow the wall on their left, and stone monkeys that steal a gem and flee until cornered.
- Boss: the Naga Warden fights in three phases. It telegraphs head strikes and tail sweeps, refills its boulders between phases and restores your hearts at each phase change.
- Difficulties: Explorer, Classic, Relic Hunter and Purist. Purist unlocks after the boss.

**The five worlds** (`src/levels/`)
- **Angkor Jungle Temples**: digging, gravity, the hammer, snakes, scarabs, monkeys, rolling stones, spikes, keys; the Naga Warden (reward: grapple).
- **Falkenstein Keep**: torch and braziers, levers and drawbridges, fire jets, blades, bats, knights, rats, conveyors, the echo; the Iron Baron (reward: frost charm).
- **Monastery of Nine Winds**: ice sliding, wind terraces, steam vents, ice spirits, yetis, the power gauntlet, light beams and sun sensors; Frostfang (reward: sun mirror).
- **Bharat Expedition**: clay-pot bazaar, stepwells, the Nandi bell, collapsing desert fort, langurs, monsoon currents, cave carving, the rotating sun lamp, the chakra disc, Kai and Meera tag team, kolam tracing, a tiger stalk; Rakta Yantra.
- **The Obsidian Vault**: ten remix stages (lethal lasers, echoes, freight belts, a timed collapse, the Heart Stone lattice) and the Obsidian Hand, who mirrors your every step.

Every stage has in-world tips, a par move count and a solution the test suite replays (no damage, quota met, exit reached); most hide a red gem and some a secret exit.

**Physics notes.** Rocks cannot be pushed upward; a falling rock is fatal on Classic and harder (two hearts on Explorer). A rock resting on your head is still safe.

**Look and feel.** A royal theme with gold-leaf SVG icons (no emoji), self-hosted Cinzel, Cinzel Decorative and Cormorant Garamond, and high-detail treasure art (`src/render/premium.js`): gold-mounted brilliant-cut sapphires, a heart-cut ruby, mossy cracked boulders, gilded crates, chibi explorers with ink outlines, and a stone-ring vortex exit. Art is painted in code once per tile size and cached.

**Around the game**
- Title screen, a skippable 4-panel story comic, and a hub map with star and crown tracking. The boss sits behind a blue-gem star gate.
- The merchant's tent sells upgrades for earned coins: heart containers, rewind capacity, swift boots, keen eye, insight well and the rock-fall lens.
- Clues cost Insight: the Explorer's journal, lantern pulse, whispering compass, and the Spirit guide, which replays the level's solution at the cost of the Crown and the par star. After repeated hits, an adaptive hint suggests a clue.
- Stage summary shows 3 stars (exit, all gems, red gem or par) plus a Crown for a flawless run. Out of hearts, you get the cause of death with a one-tap rewind or a checkpoint restart.
- Rendering (`src/render/`): all sprites are procedural (hand-drawn with canvas shapes, so there are no copied assets). There are 150 ms slide animations, squash and stretch, particles, screen shake, hit-stop, torch lighting for dark rooms, a rock-fall ghost preview, and an HD/Retro filter.
- Audio (`src/audio/`): all synthesised with Web Audio. There are Classic-layer effects from the GDD 8.5 recipes and the pentatonic gem combo ladder from 8.6. The original looping music has base, danger and discovery stems, plus a counter-melody when the exit opens and a heartbeat on your last heart. There are victory and game-over jingles, music ducking, and an 8-voice cap with priorities.
- Progress saves in `localStorage` and survives private mode by falling back to memory. A web manifest and service worker allow install and offline play.

## Android APK

`dist/DiamondCrush.apk` is a ready-to-install build (Android 7.0+). It is a full-screen WebView that serves the game from inside the APK, so it plays fully offline; the back button pauses the game or closes menus.

Rebuild it with:

```sh
node tools/android-icons.mjs   # optional: re-render launcher icons (needs npm start running)
python3 android/build_apk.py   # → dist/DiamondCrush.apk
```

The build needs only Java and Python: it fetches dx, apksig and the Android framework jar from Maven Central, compiles and dexes `android/src`, encodes the binary manifest and resource table itself, aligns the zip and signs it (APK signature scheme v2). The signing key is created on first run at `android/keystore/release.p12` (git-ignored). Keep it: Android only installs updates signed with the same key. Use your own key with `DC_KEYSTORE`, `DC_KEYSTORE_PASS` and `DC_KEY_ALIAS`. For the Play Store, upload an Android App Bundle built with the standard Android toolchain, or enrol this key in Play App Signing.

**Not in this build** (these are later phases of the GDD roadmap):
- The level editor, Daily Relic Puzzle, weekly expeditions, leaderboards, ghost races and echo stones.
- Relic museum, season pass, in-app purchases and ads, localisation and the India edition.
- Play Store integration (billing, achievements, cloud save).
- Tap-to-path and soft-lock detection. The pause menu's restart and the rewind cover these for now.

## Project layout

```
index.html, styles.css      shell, screens, control deck, modals
src/main.js                 boot, hub map, shop, settings, pause/summary flow
src/game.js                 a running stage: clocks, input buffer, rewind, checkpoints, events → sound
src/input.js                keyboard, gamepad, swipe, D-pad, joystick, keypad; hold-to-walk
src/engine/                 rules (sim.js), level parsing, constants, solution replay, ASCII view
src/levels/                 world definitions; angkor.js holds every World 1 map
src/render/                 renderer, procedural sprites, palettes
src/audio/audio.js          synth SFX, gem ladder, music sequencer
src/ui/art.js               title backdrop and comic panels
tools/                      dev server and level-authoring tools
tests/                      engine rules and level solution tests
```

## Authoring levels

Maps are ASCII grids (GDD 9.5): `W` wall, `.` floor, `E` earth, `B` boulder, `R` rolling stone, `G` gem, `*` red gem, `H` hero, `X` exit, `C` cracked wall, `F` false wall, `O` pit, `^` spikes, `P` checkpoint idol, `K`/`D` red key/door, `S`/`s` snakes, `A` scarab, `M` monkey, `h` hammer, `Y` secret exit. The full list is in `src/engine/level.js`, and each level can add its own characters through `legend`.

```sh
# Play moves on a level and print the board. "@x,y" walks there by search.
node tools/play.js 1-4 "@9,1 DDD L .......... lT" --trace
# Search for a move sequence that reaches a goal (win, bosshit, gems:N).
node tools/search.js 1-B "" bosshit 20
```

Moves are written as `U D L R`. `T` uses the tool, `.` waits one tick, lowercase letters turn the hero to face a direction without stepping, and `<` `>` cycle tools. Every level must ship a `solution` that `npm test` replays from a fresh start, checking that it reaches the exit with the quota and takes no damage.

## IP note

Following the GDD's guardrails, everything here is original: the name, characters, level layouts, art (drawn in code) and music (newly composed). The game borrows only the genre's rules and feel.
