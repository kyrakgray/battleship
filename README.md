# Battleship

A browser-based game of Battleship: you place a five-ship fleet on a 10×10 grid
and trade shots with a computer opponent until one fleet is sunk. Built with
vanilla HTML, CSS, and JavaScript — no frameworks, no build step, no package
manager, no backend.

**Play it live: https://kyrakgray.github.io/battleship/**

## Running it locally

Clone the repo and open `index.html` in any modern browser:

```sh
git clone https://github.com/kyrakgray/battleship.git
cd battleship
open index.html        # macOS; use xdg-open on Linux, start on Windows
```

There is nothing to install or compile. A `file://` load is enough; the tests
work the same way. If you prefer a server, `python3 -m http.server` in the repo
root and browse to `http://localhost:8000/`.

## How to play

Select a ship, press <kbd>R</kbd> to toggle horizontal/vertical, and click a
square on **Your Fleet** to drop it — a preview follows the cursor, green when
the placement is legal and red when it is not. **Place Randomly** fills the
board for you and **Reset Placement** clears it. **Start Game** unlocks once
all five ships are down; you fire first by clicking a square on **Enemy
Waters**. Red is a hit, white is a miss, the message names the ship you struck
or sank, and the banner above the boards always says whose turn it is and what
just happened. Sink all five enemy ships to win.

## File structure

| File | Responsibility |
| --- | --- |
| `index.html` | Document structure and element hooks: the how-to panel, controls, message log, status banner, both boards, and the fleet status panels. Asset URLs carry a `?v=` query string for cache-busting on GitHub Pages. |
| `styles.css` | All presentation: grid rendering, ship colors, hit/miss pegs, panels, the status banner's per-state colors, and the responsive layout. |
| `game.js` | All rules and state as plain data — board creation, placement validation, random fleets, firing, sink and win detection, and opponent targeting. No DOM access, so every rule is testable in isolation. |
| `ui.js` | Rendering and event wiring: builds the grids, tracks the placement cursor, gates input by phase, runs the turn loop with the opponent's ~600 ms delay, writes the log and banner, and resets state on New Game. It delegates every rule to `game.js`. |
| `tests/placement-tests.html` | Placement assertions, including 10,000 random fleets. |
| `tests/simulate-games.html` | 100 complete games through the full turn loop. |
| `tests/ai-benchmark.html` | 1,000 games per strategy: random vs hunt-and-target. |
| `tests/ai-audit.html` | Opponent-memory lifetime, off-cadence calls, and shot legality. |
| `.github/workflows/pages.yml` | Publishes the repo root to GitHub Pages on push to `main`. |

Board state is a plain object — `{ size, grid, shots, ships }`, where
`grid[row][col]` holds a ship id or `null` and `shots[row][col]` holds `'hit'`,
`'miss'`, or `null` — so the rules can be driven without a browser. The player
and opponent boards are the same shape, and `ui.js` holds no rule logic of its
own.

## How the opponent works

`chooseOpponentTarget(board, rng)` in `game.js` is the opponent's entire
strategy: it takes the board being fired upon and returns a `{ row, col }`, or
`null` when nothing is left. `rng` is optional and defaults to `Math.random`,
matching `placeFleetRandomly`, so seeded runs are reproducible.

In **hunt mode** it fires at a uniformly random un-fired square. A hit switches
it to **target mode**: the hit's on-board, un-fired orthogonal neighbours are
queued, and while the queue is non-empty it fires from the queue instead of at
random. Once two hits line up, squares that extend that axis are preferred over
perpendicular neighbours, because ships are straight. When a ship is announced
sunk, only the queued squares descended from hits on *that* ship are retired —
hits belonging to a different, still-floating ship stay queued, so sinking one
of two touching ships does not reset the opponent to hunt mode.

The opponent never reads ship positions. It rebuilds its knowledge on each call
from its own shot history (`board.shots`) plus the sink announcements a human
opponent would also hear, and caches that per board in a `WeakMap`; clearing a
board discards the cache, so nothing carries between games.

## Running the tests

There is no test runner and nothing to install — open each file in a browser
and read the `<pre>` block, which ends in an explicit pass/fail line.

| File | What it asserts | Latest run |
| --- | --- | --- |
| `tests/placement-tests.html` | Overlap and out-of-bounds rejection, board clearing, and 10,000 random fleets being in-bounds, non-overlapping, and exactly 17 cells. | ALL TESTS PASSED |
| `tests/simulate-games.html` | 100 complete games each end with exactly one winner inside 200 turns. | 100/100, max 166 turns, average 108.4 |
| `tests/ai-benchmark.html` | 1,000 games per strategy, no square fired on twice, every game terminates, and the adjacent-ship case keeps hunting the second ship. | random 95.6 shots average, hunt-and-target 60.4 (36.8% fewer) |
| `tests/ai-audit.html` | Opponent memory does not survive a New Game, repeated or skipped `chooseOpponentTarget` calls neither drop nor repeat targets, and no shot is ever off-board or repeated — including from each corner. | ALL AUDIT CHECKS PASSED |

## Not implemented

These are deliberate scope decisions, not oversights:

- **The SALVO variant** from the official rules — firing one shot per surviving
  ship each turn, and the associated "call your shots up front" bookkeeping —
  was intentionally not built. The game implements the standard one-shot-per-turn
  rules only.
- **Two-player play** of any kind: no hot-seat, no networking, no backend. The
  opponent is always the computer.
- **Smarter hunting.** Hunt mode is uniformly random; probability-density
  targeting and parity hunting (never wasting a shot on a square that cannot
  hold the smallest surviving ship) are not implemented.
- **Difficulty levels** or any way to configure the opponent from the UI.
- **Scoring, statistics, or match history**, and no persistence between page
  loads — reloading starts over.
- **Sound, animation, and a mobile-tuned layout.** The layout is responsive
  enough to use on a narrow screen but is designed for desktop.
- **Automated regression testing infrastructure.** The `tests/` files are
  hand-run browser harnesses, deliberately dependency-free, not a CI suite.
