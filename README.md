# Battleship — ship placement slice

A browser-based Battleship game, built with vanilla HTML, CSS, and JavaScript.
No frameworks, no build step, no package manager, no backend: open `index.html`
in a browser and it runs.

## What is built so far

- Two 10×10 grids side by side: **Your Fleet** (left, interactive) and
  **Enemy Waters** (right, rendered but empty and non-interactive).
  Rows are labeled A–J top to bottom, columns 1–10 left to right.
- A five-ship fleet the player places on their own grid: Carrier (5),
  Battleship (4), Cruiser (3), Submarine (3), Destroyer (2).
- Manual placement: select a ship, press <kbd>R</kbd> to toggle
  horizontal/vertical, click a square to place it. A live preview follows the
  cursor — green when the placement is valid, red when it is not.
- Enforced placement rules: horizontal or vertical only (never diagonal), no
  overlapping ships, no ship extending past the edge of the grid. Invalid
  placements are rejected with a visible message stating the reason.
- **Place Randomly** — positions all five ships in valid random positions.
- **Reset Placement** — clears the board.
- **Start Game** — disabled until all five ships are placed; currently only
  logs the fleet to the console.

## Not yet implemented

- Firing, turns, hit/miss resolution, and sinking ships
- Scoring and win/lose conditions
- The AI opponent and any enemy ship placement
- Persistence of board state between page loads

## Code structure

| File | Purpose |
| --- | --- |
| `index.html` | Markup and element hooks |
| `styles.css` | Board, fleet, and preview styling |
| `game.js` | Game state and rules — plain data structures, no DOM access |
| `ui.js` | Rendering and event wiring; delegates all rules to `game.js` |
| `tests/placement-tests.html` | Assertions over `game.js`, run by opening the file |

Board state is a plain object (`{ size, grid, ships }`) where `grid[row][col]`
holds a ship id or `null`, so it can be exercised without a DOM. Placement
validation lives in reusable functions (`validatePlacement`, `placeShip`,
`placeFleetRandomly`, ...) rather than inline in event handlers, ready for the
game loop and AI opponent in later sessions.

## Tests

Open `tests/placement-tests.html` in a browser. It exercises overlap and
out-of-bounds rejection, board clearing, and 10,000 random fleets (checking
every fleet is in-bounds, non-overlapping, and occupies exactly 17 cells).
