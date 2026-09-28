# Diamond Crush

A top-down, grid-based treasure-hunting puzzle adventure for HTML5 Canvas, built from the *Diamond Crush: The Lost Expeditions* game design document. You dig through earth, push boulders, dodge falling rocks, crush snakes and collect every gem, with rewinds, clues and a portrait-first control deck.

This build is a playable vertical slice: the full rules engine plus **World 1, the Angkor Jungle Temples**, complete with 10 stages, 2 secret stages and the Naga Warden boss.

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
| Use tool | A button | Space | A | 5 |
| Cycle tool | ⇄ Tool | Q / E | LB / RB | * / # |
| Rewind one step | B button | Z / Backspace | B | 0 |
| Rock-fall preview (hold) | Map | M / Tab | Y | 1 |
| Lantern clue | 🏮 | L | | 7 |
| Pause | ❚❚ | Esc / P | Start | 3 |

Settings can switch the deck between D-pad, floating joystick, a retro phone keypad, or swipe-only. They also cover left-handed mirroring, button size and opacity, and the game/deck split (you can drag the divider too). There are toggles for the Retro filter (24 px art with LCD lines), reduced motion, haptics, volumes and the four difficulty modes. On landscape phones the deck moves to the sides.

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

**World 1: Angkor.** It has Root Gate, Falling Stones, Hall of Faces (hammer), Serpent Steps, Monkey Business, Scarab Crossing, The Rolling Court, Spike Garden, Keys of the Apsara and Heart of the Jungle. There are secret exits in stages 4 and 8 leading to Vine Vault (plates and gates) and Moonlit Shrine (a dark room lit only by your torch), plus the Naga Warden. Each level has in-world tips, a red gem behind a secret or puzzle, a par move count and a verified solution.

**Around the game**
- Title screen, a skippable 4-panel story comic, and a hub map with star and crown tracking. The boss sits behind a blue-gem star gate.
- The merchant's tent sells upgrades for earned coins: heart containers, rewind capacity, swift boots, keen eye, insight well and the rock-fall lens.
- Clues cost Insight: the Explorer's journal, lantern pulse, whispering compass, and the Spirit guide, which replays the level's solution at the cost of the Crown and the par star. After repeated hits, an adaptive hint suggests a clue.
- Stage summary shows 3 stars (exit, all gems, red gem or par) plus a Crown for a flawless run. Out of hearts, you get the cause of death with a one-tap rewind or a checkpoint restart.
- Rendering (`src/render/`): all sprites are procedural (hand-drawn with canvas shapes, so there are no copied assets). There are 150 ms slide animations, squash and stretch, particles, screen shake, hit-stop, torch lighting for dark rooms, a rock-fall ghost preview, and an HD/Retro filter.
- Audio (`src/audio/`): all synthesised with Web Audio. There are Classic-layer effects from the GDD 8.5 recipes and the pentatonic gem combo ladder from 8.6. The original looping music has base, danger and discovery stems, plus a counter-melody when the exit opens and a heartbeat on your last heart. There are victory and game-over jingles, music ducking, and an 8-voice cap with priorities.
- Progress saves in `localStorage` and survives private mode by falling back to memory. A web manifest and service worker allow install and offline play.

**Not in this build** (these are later phases of the GDD roadmap):
- Worlds 2 to 5, which appear on the map as locked tabs, and their mechanics: ice, conveyors, light beams, water levels, and Meera tag-team play.
- The level editor, Daily Relic Puzzle, weekly expeditions, leaderboards, ghost races and echo stones.
- Relic museum, season pass, in-app purchases and ads, localisation and the India edition.
- The native Android wrapper and Play Store integration.
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
