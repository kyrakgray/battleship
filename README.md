# Battleship

A browser-based Battleship game against a computer opponent, built with vanilla
HTML, CSS, and JavaScript. No frameworks, no build step, no package manager, no
backend: open `index.html` in a browser and it runs.

Live: https://kyrakgray.github.io/battleship/

## What is built so far

### Placement

- Two 10×10 grids side by side: **Your Fleet** (left) and **Enemy Waters**
  (right). Rows are labeled A–J top to bottom, columns 1–10 left to right.
- A five-ship fleet the player places on their own grid: Carrier (5),
  Battleship (4), Cruiser (3), Submarine (3), Destroyer (2). Each ship has its
  own color, shown in the fleet menu and on the grid once placed.
- Manual placement: select a ship, press <kbd>R</kbd> to toggle
  horizontal/vertical, click a square to place it. A live preview follows the
  cursor — green when the placement is valid, red when it is not.
- Enforced placement rules: horizontal or vertical only (never diagonal), no
  overlapping ships, no ship extending past the edge of the grid. Invalid
  placements are rejected with a visible message stating the reason.
- **Place Randomly** and **Reset Placement** buttons.
- **Start Game** is disabled until all five ships are placed.

### Game loop

- **Start Game** places the opponent's five ships randomly (using the same
  placement/validation functions as the player's fleet). Opponent ship
  positions are never rendered or exposed in the DOM — the enemy grid is drawn
  from shot results only. The player takes the first shot.
- Fire by clicking a square on Enemy Waters. Hits are red, misses are white,
  and both persist on the grid.
- Clicking an already-fired square does nothing: no message, no turn consumed.
- A hit names the struck ship ("Hit. Cruiser."), and sinking one announces it
  by name ("You sank my Battleship!", and the equivalent when the opponent
  sinks one of yours).
- A message log keeps every turn of the current game, scrollable so earlier
  shots can be read back.
- A fleet status panel lists all five ships for each side, with sunk ships
  struck through.
- After the player's shot resolves the opponent fires ~600ms later, with a
  message while its turn resolves. Both grids are non-interactive during that
  window; clicks are ignored, not queued.
- The game ends when either fleet is completely sunk: a win or loss result is
  shown and further input is ignored.
- **Reveal Enemy Ship Locations** appears only after a loss (a win already
  exposes every enemy square) and toggles
  the enemy fleet into view: squares the player hit stay red, and the squares
  they never found show in their ship's color.
- **New Game** returns to ship placement with fully cleared state — no
  leftover ships, shots, or log entries.

### Opponent targeting — hunt and target

`chooseOpponentTarget(board, rng)` in `game.js` returns a `{ row, col }`
coordinate and is the opponent's whole strategy; turn handling and rendering
do not depend on how it picks. `rng` is optional and defaults to `Math.random`,
so seeded runs are reproducible.

- **Hunt mode** (default): fire at a uniformly random un-fired square.
- **Target mode**: a hit queues its orthogonal neighbours (on-board and
  un-fired). While the queue is non-empty the opponent fires from it.
- **Directional preference**: once two hits line up, squares extending that
  axis are fired before perpendicular neighbours — ships are straight.
- **Sink handling**: when a ship is announced sunk, only the queued squares
  that came from hits on *that* ship are retired. Hits on a different,
  still-floating ship stay in the queue, so hitting two adjacent ships and
  sinking one does not reset the opponent to hunt mode.

The opponent never reads ship positions. It works from its own shot history
(`board.shots`) plus the sink announcements a human opponent would also hear,
cached per board.

## Not yet implemented

- Probability-density targeting or parity-based hunting (hunt mode is still
  uniformly random)
- Scoring, statistics, or match history
- Persistence of game state between page loads
- Sound, animation, or mobile-specific layout

## Code structure

| File | Purpose |
| --- | --- |
| `index.html` | Markup and element hooks |
| `styles.css` | Board, fleet, panel, and log styling |
| `game.js` | Game state and rules — plain data structures, no DOM access |
| `ui.js` | Rendering and event wiring; delegates all rules to `game.js` |
| `tests/placement-tests.html` | Placement assertions over `game.js` |
| `tests/simulate-games.html` | 100-game simulation of the full turn loop |
| `tests/ai-benchmark.html` | 1,000-game comparison of random vs hunt-and-target |

Board state is a plain object (`{ size, grid, shots, ships }`) where
`grid[row][col]` holds a ship id or `null` and `shots[row][col]` holds `'hit'`,
`'miss'`, or `null`, so it can be exercised without a DOM. Rules live in
reusable functions (`validatePlacement`, `placeShip`, `placeFleetRandomly`,
`fireAt`, `isShipSunk`, `isFleetDefeated`, `chooseOpponentTarget`) rather than
inline in event handlers.

## Checks

Open any of these files in a browser:

- `tests/placement-tests.html` — overlap and out-of-bounds rejection, board
  clearing, and 10,000 random fleets (in-bounds, non-overlapping, exactly 17
  cells).
- `tests/simulate-games.html` — simulates 100 complete games and asserts each
  ends with exactly one winner within 200 total turns. Latest run: 100/100 had
  exactly one winner, max 168 turns.
- `tests/ai-benchmark.html` — 1,000 games per strategy against randomly placed
  fleets, asserting no square is fired on twice and every game terminates.
  Latest run: random targeting averages **95.6** shots to clear a fleet,
  hunt-and-target averages **60.4** (36.8% fewer). It also checks the
  adjacent-ship case: sinking one of two touching ships keeps the opponent
  hunting the other.
