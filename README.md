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
- A message log shows the last several turns for both sides.
- A fleet status panel lists all five ships for each side, with sunk ships
  struck through.
- After the player's shot resolves the opponent fires ~600ms later, with a
  message while its turn resolves. Both grids are non-interactive during that
  window; clicks are ignored, not queued.
- The game ends when either fleet is completely sunk: a win or loss result is
  shown and further input is ignored.
- **New Game** returns to ship placement with fully cleared state — no
  leftover ships, shots, or log entries.

### Opponent targeting (placeholder)

`chooseOpponentTarget(board, rng)` in `game.js` picks a uniformly random square
that has not been fired on and returns `{ row, col }`. It is deliberately
isolated from turn handling and rendering so it can be swapped for a
hunt-and-target algorithm without touching the UI.

## Not yet implemented

- A smarter AI (hunt-and-target); the opponent currently fires at random
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
| `tests/simulate-games.html` | 100-game random-vs-random simulation |

Board state is a plain object (`{ size, grid, shots, ships }`) where
`grid[row][col]` holds a ship id or `null` and `shots[row][col]` holds `'hit'`,
`'miss'`, or `null`, so it can be exercised without a DOM. Rules live in
reusable functions (`validatePlacement`, `placeShip`, `placeFleetRandomly`,
`fireAt`, `isShipSunk`, `isFleetDefeated`, `chooseOpponentTarget`) rather than
inline in event handlers.

## Checks

Open either file in a browser:

- `tests/placement-tests.html` — overlap and out-of-bounds rejection, board
  clearing, and 10,000 random fleets (in-bounds, non-overlapping, exactly 17
  cells).
- `tests/simulate-games.html` — simulates 100 complete games with both sides
  firing at random and asserts each ends with exactly one winner within 200
  total turns. Latest run: 100/100 games had exactly one winner, max 199 turns,
  average 185.9.
