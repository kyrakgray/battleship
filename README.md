# The California Five

A browser game of hidden-route deduction, themed on California's national
parks. You and a rival explorer each draw a five-park itinerary on a 10×10 map,
seal it, and trade. You spend scouting days guessing squares on the route you
were handed; find every square of a park and it is stamped in your passport.
First explorer to stamp all five parks — the California Five — wins.

It is the annual California National Park Summer Classic: Tioga Pass opened
late on the fourth of July after a heavy winter and an early El Niño closes it
100 days later, so each explorer has 100 trail days and every square scouted
costs one of them.

Built with vanilla HTML, CSS, and JavaScript — no frameworks, no build step, no
package manager, no backend.

**Play it live: https://kyrakgray.github.io/battleship/**

| Park | Squares | Acres |
| --- | --- | --- |
| Death Valley | 5 | 3,408,396 |
| Joshua Tree | 4 | 795,156 |
| Yosemite | 3 | 761,748 |
| Kings Canyon | 3 | 461,901 |
| Sequoia | 2 | 404,063 |

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

Route planning has the page to itself: a single paper map, no log and no
calendar. Select a park, press <kbd>R</kbd> to toggle across/down, and click a
square on **Your Route Map** to lay it down — a preview follows the cursor,
green when the placement is legal and red when it is not. Parks run in straight
lines only, cannot overlap, and cannot run off the map. **Draw a Random Route**
fills the map for you and **Clear Route** wipes it. **Seal & Trade Routes**
unlocks once all five parks are down and shows the itinerary sealed in an
envelope under a CA 5 wax seal; trading it starts the season and brings out the
rival map, the calendar, the log and both passports.

Two windows open the game. **The Story** tells the story of the Classic behind
a park badge and lists the year's five parks, each beside its own icon, and
hands off to **How to Play**, which ends in **Enter the Classic**. Both stay in
the controls during the season, so either can be reopened mid-game.

You take the first scouting day by clicking a square on **The Route Drawn For
You**. A pale square carrying a road barricade is a dead end — a day burned on
a forest road. A coloured square is a trail marker drawn with the icon of the
park you are standing in, in that park's own colour: Half Dome for Yosemite, a
crown for Kings Canyon, a Joshua tree, a sequoia, and a skull and crossbones
for Death Valley. The message names the park you are on. Finding
the last square of a park stamps it into your passport with a dated rubber
stamp in that park's colour, in the passport booklet under each map. The
calendar under the banner opens on July 4, 2026 and turns over only once both
explorers have taken the day; beside it are the trail days you have spent of
your hundred, the days left before the pass closes, and how many days your
rival has spent. The Explorer's Log keeps every dated entry of the season —
the window shows the last few and scrolls back to the first. When either
explorer collects all five stamps, a result window reports the winner and both
season cards: trail days, squares found, dead ends, scouting accuracy, stamps
collected, and days left before the pass closes.

## File structure

| File | Responsibility |
| --- | --- |
| `index.html` | Document structure and element hooks: the story and how-to windows, controls, field notes, status banner, both maps, and the passport panels. It also holds the inline SVG sprite — the badge, the five park icons, and the dead-end barricade — so the artwork needs no external files or network. Asset URLs carry a `?v=` query string for cache-busting on GitHub Pages. |
| `styles.css` | All presentation: grid rendering, per-park colors, trail-marker/dead-end squares, passport stamp slots, the status banner's per-state colors, and the responsive layout. |
| `game.js` | All rules and state as plain data — board creation, placement validation, random routes, scouting days, stamp and win detection, and rival targeting. No DOM access, so every rule is testable in isolation. |
| `ui.js` | Rendering and event wiring: builds the grids, tracks the placement cursor, gates input by phase, runs the turn loop with the rival's ~600 ms delay, writes the field notes and banner, and resets state on New Season. It delegates every rule to `game.js`. |
| `audio.js` | Trail sound: the Sound Effects / Voiceover settings (remembered in `localStorage`), Web Audio–synthesized cues (pencil on the map, a park's trail-marker note, the dead-end thud, the passport stamp), and the ranger's lines. Voice clips are pre-rendered mp3s under `voice/`; if one is missing the browser's own speech synthesis reads the line instead. |
| `voice.js` | Scouting by voice: turns what the browser's speech recognition hears ("scout A4", "alpha four") into a square and hands it down the same path a click takes. Support is uneven across browsers, so the control disables itself where recognition is missing and clicking always works. |
| `tests/placement-tests.html` | Placement assertions, 10,000 random routes, and the no-premature-stamp rule. |
| `tests/simulate-games.html` | 100 complete games through the full turn loop. |
| `tests/ai-benchmark.html` | 1,000 games per strategy: random roaming vs roam-and-follow. |
| `tests/ai-audit.html` | Rival-memory lifetime, off-cadence calls, and scouting-day legality. |
| `tests/ui-harness.html` | Drives the real page in an iframe: story → how-to → Enter the Classic and reopening both mid-game, badge and park icons, acreage, placement gating, the calendar holding and turning over, a full season with both square icons drawn and dated passport stamps, and the New Season reset. |
| `.github/workflows/pages.yml` | Publishes the repo root to GitHub Pages on push to `main`. |

Board state is a plain object — `{ size, grid, days, parks }`, where
`grid[row][col]` holds a park id or `null` and `days[row][col]` holds
`'marker'` (trail marker), `'dead-end'`, or `null` — so the rules can be driven
without a browser. `SEASON_DAYS` is 100, and `daysSpent(board)` / `daysLeft(board)`
read the season clock off a map. Both explorers' maps are the same shape, and
`ui.js` holds no rule logic of its own. Each park also carries a `region`
(`desert` or `sierra`), used today only for flavor.

## How the rival works

`chooseRivalSquare(board, rng)` in `game.js` is the rival's entire strategy:
it takes the map being scouted and returns a `{ row, col }`, or `null` when
nothing is left. `rng` is optional and defaults to `Math.random`, matching
`placeRouteRandomly`, so seeded runs are reproducible.

In **roaming mode** it scouts a uniformly random unvisited square. A trail marker
switches it to **follow mode**: the marker's on-board, unvisited orthogonal
neighbours are queued, and while the queue is non-empty it scouts from the queue
instead of at random. Once two markers line up, squares that extend that axis are
preferred over perpendicular neighbours, because parks run straight. When a park
is stamped, only the queued squares descended from markers on *that* park are
retired — markers belonging to a different, unstamped park stay queued, so
stamping one of two touching parks does not send the rival back to roaming.

The rival never reads park positions. It rebuilds its knowledge on each call
from its own scouting history (`board.days`) plus the stamp announcements a
human rival would also hear, and caches that per board in a `WeakMap`;
clearing a board discards the cache, so nothing carries between seasons.

## Running the tests

There is no test runner and nothing to install — open each file in a browser
and read the `<pre>` block, which ends in an explicit pass/fail line.

| File | What it asserts | Latest run |
| --- | --- | --- |
| `tests/placement-tests.html` | Overlap and out-of-bounds rejection, board clearing, 10,000 random routes being in-bounds, non-overlapping and exactly 17 cells, and that a park is stamped only once its final square is found. | ALL TESTS PASSED |
| `tests/simulate-games.html` | 100 complete games each end with exactly one winner inside 200 turns. | 100/100, max 161 turns, average 102.3 |
| `tests/ai-benchmark.html` | 1,000 games per strategy, no square scouted twice, every game terminates, and the adjacent-park case keeps working the second park. | random 95.6 days average, roam-and-follow 60.4 (36.8% fewer) |
| `tests/ai-audit.html` | Rival memory does not survive a New Season, repeated or skipped `chooseRivalSquare` calls neither drop nor repeat squares, and no scouting day is ever off-board or repeated — including from each corner. | ALL AUDIT CHECKS PASSED |
| `tests/ui-harness.html` | The page itself, end to end. Needs same-origin iframe access: open it over `python3 -m http.server`, or in Chrome with `--allow-file-access-from-files`. | UI SMOKE RUN PASSED |

## Not implemented

These are deliberate scope decisions, not oversights:

- **A trail-day cost asymmetry.** Every square costs exactly one trail day;
  Sierra days costing two and desert days one was considered and dropped. The
  `region` field on each park is in place if it ever comes back.
- **A season-expiry ending.** The clock counts each explorer's days
  independently, 100 each on a 100-square map, so it reads as a race tracker:
  the game still ends when someone stamps all five parks. Running the pass
  closed with neither itinerary finished is not a separate loss condition.
- **Drag-to-place.** Routes are drawn by selecting a park and clicking a square,
  with <kbd>R</kbd> to rotate. Dragging a park card onto the map is not built.
- **The SALVO variant** from the original board game's rules — one guess per
  surviving unit each turn, plus the "call them all up front" bookkeeping — was
  intentionally not built. The game uses one scouting day per turn only.
- **Two-player play** of any kind: no hot-seat, no networking, no backend. The
  rival is always the computer.
- **Smarter roaming.** Roaming mode is uniformly random; probability-density
  scouting and parity roaming (never wasting a day on a square that cannot hold
  the smallest unstamped park) are not implemented.
- **Difficulty levels** or any way to configure the rival from the UI.
- **Scoring, statistics, or match history**, and no persistence between page
  loads — reloading starts over.
- **Sound, animation, and a mobile-tuned layout.** The layout is responsive
  enough to use on a narrow screen but is designed for desktop.
- **Automated regression testing infrastructure.** The `tests/` files are
  hand-run browser harnesses, deliberately dependency-free, not a CI suite.
