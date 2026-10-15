# Iron Dome: Typing Defense

A complete, offline-capable browser arcade game. Defend a glowing energy shield by typing the words attached to incoming threats and pressing **Enter**.

**Play:** https://ilaymelamed.github.io/First_Lab/

## Run locally

Open `index.html` in a current desktop browser. No installation, server, build, external fonts, or network requests are required. A physical keyboard is recommended. The game adapts to smaller windows, but a wider window gives the words more space.

## Controls

- Type an incoming word and press **Enter** to intercept it. Matching is case-insensitive and requires the complete word.
- **Backspace** corrects a typo. Incorrect submissions clear immediately and reset the streak.
- **Escape** pauses/resumes. The pause button provides resume, restart, and main-menu controls.
- Clicking the map or typing a letter returns focus to the command input. Browser shortcuts remain available.
- Changing tabs or leaving the window pauses the mission. A long stalled frame also pauses before advancing gameplay.

## Missions and scoring

There are ten timed missions, from 10–15 WPM to 60+ WPM, and five threat classes. Every mission begins with five hearts. A threat reaching the shield boundary costs exactly one heart. Twelve consecutive correct interceptions restore one heart, capped at eight. A breach or incorrect submission resets the streak.

Base scores are 50 (small drone), 100 (UAV), 150 (cruise missile), 250 (ballistic), and 400 (heavy ballistic). Early interceptions earn up to 40% extra. Every third consecutive interception increases the streak bonus by five points, capped at 100 bonus points per target.

Completing a mission earns `500 + 150 × zero-based mission index + 75 × remaining hearts`. Completing with at least one submission and no incorrect submissions adds 250. Scores are per mission. All ten missions are playable from the start. Choose any mission from Select Level; completion badges and best scores are still saved. Play continues with the first incomplete mission.

The difficulty director budgets workload using expected characters per second, active letter count, reaction time, outstanding deadlines, and per-level concurrency limits. It only admits a threat when an earliest-deadline schedule remains feasible. It allocates long words longer deadlines and heavy threats a launch warning, and avoids repeated words and crowded launch sectors. Difficulty does not secretly adapt to player performance.

## Statistics and saving

A standard word is **five correctly intercepted characters**. Live WPM uses a rolling 15-second window; average WPM uses elapsed gameplay time. Idle gameplay time remains in the denominator, and paused time is excluded. Peak WPM is the highest live WPM. Accuracy is accepted characters divided by all submitted characters; empty submissions count as one failed character. Corrected typos that were never submitted do not reduce accuracy.

Settings, callsign, completed missions, per-level best scores, and the top ten mission records are stored under `iron-dome-typing-defense-v1` in this browser's LocalStorage. Invalid saved data is handled safely. If browser storage is unavailable, gameplay and in-memory saving still work. `file://` and the hosted website use separate browser storage.

Sound effects use Web Audio after a user gesture. Sound, animation quality, and reduced motion are configurable. Reduced motion follows the system preference initially. No music is included.

## Source files

- `index.html`: accessible menu screens, HUD, and game shell.
- `style.css`: responsive interface, transitions, and motion preferences.
- `script.js`: state/navigation, keyboard controls, audio, statistics display, and storage. Owns the single animation loop.
- `game-core.js`: DOM-independent simulation, word banks, scoring, collision, and difficulty director. `LEVELS`, `TYPES`, `WORLD`, and `WORD_BANKS` centralize balancing configuration.
- `renderer.js`: cached Canvas map, flags, distinct aircraft sprites, label placement, shield, and effects.
- `assets/menu-art.png`: original generated menu illustration, bundled locally.
- `assets/favicon.svg`: original vector icon.
- `tests/engine.test.cjs`: deterministic regression and balance simulations.

The map is artistically compressed around Israel for playable travel distances. All launch zones belong to a fictional arcade scenario and do not represent residents or governments. The Canvas map and gameplay sprites are original programmatic artwork.

## Validation

With Node.js available, run:

```sh
node --test tests/engine.test.cjs
```

The tests exercise submissions, exact boundary impacts, streak hearts, scoring/statistics, victory/loss, restart independence, word uniqueness, deadline budgets, and simulated typists over all ten levels. Browser QA additionally exercises the actual keyboard/input flow, every screen, saving/reloading, pause/restart, winning/losing, Canvas effects, and responsive layouts.

## Publish updates

GitHub Pages publishes the root of the `main` branch:

```sh
git add .
git commit -m "Describe the change"
git push
```

Wait for the **pages build and deployment** workflow to complete. The live site uses all local assets and needs no additional deployment tooling.
