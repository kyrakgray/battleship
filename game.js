/**
 * Battleship game state.
 *
 * Pure data + logic, no DOM access. Everything here is testable in isolation
 * (node, a test runner, or the browser console).
 */
(function (root) {
  'use strict';

  var BOARD_SIZE = 10;
  var ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  var SHIP_TYPES = [
    { id: 'carrier', name: 'Carrier', length: 5, color: '#f0c419' },
    { id: 'battleship', name: 'Battleship', length: 4, color: '#e9762f' },
    { id: 'cruiser', name: 'Cruiser', length: 3, color: '#2fa8c9' },
    { id: 'submarine', name: 'Submarine', length: 3, color: '#8f6bd6' },
    { id: 'destroyer', name: 'Destroyer', length: 2, color: '#d76ba6' }
  ];

  var ORIENTATIONS = { HORIZONTAL: 'horizontal', VERTICAL: 'vertical' };

  function emptyGrid() {
    var grid = [];
    for (var row = 0; row < BOARD_SIZE; row++) {
      var line = [];
      for (var col = 0; col < BOARD_SIZE; col++) {
        line.push(null);
      }
      grid.push(line);
    }
    return grid;
  }

  /**
   * Creates an empty board state.
   * `grid[row][col]` holds a ship id or null; `shots[row][col]` holds
   * 'hit', 'miss', or null.
   */
  function createBoard() {
    return { size: BOARD_SIZE, grid: emptyGrid(), shots: emptyGrid(), ships: {} };
  }

  function inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function getShipType(shipId) {
    for (var i = 0; i < SHIP_TYPES.length; i++) {
      if (SHIP_TYPES[i].id === shipId) return SHIP_TYPES[i];
    }
    return null;
  }

  /** Cells a ship of `length` would occupy from an origin, ignoring validity. */
  function shipCells(row, col, length, orientation) {
    var cells = [];
    for (var i = 0; i < length; i++) {
      cells.push(
        orientation === ORIENTATIONS.VERTICAL
          ? { row: row + i, col: col }
          : { row: row, col: col + i }
      );
    }
    return cells;
  }

  function coordLabel(row, col) {
    return (ROW_LABELS[row] || '?') + (col + 1);
  }

  /**
   * Validates a placement.
   * Returns { valid: boolean, reason: string|null, cells: Array }.
   */
  function validatePlacement(board, shipId, row, col, orientation) {
    var type = getShipType(shipId);
    if (!type) {
      return { valid: false, reason: 'Unknown ship.', cells: [] };
    }
    if (orientation !== ORIENTATIONS.HORIZONTAL && orientation !== ORIENTATIONS.VERTICAL) {
      return { valid: false, reason: 'Ships must be placed horizontally or vertically.', cells: [] };
    }
    if (board.ships[shipId]) {
      return { valid: false, reason: type.name + ' is already placed.', cells: [] };
    }

    var cells = shipCells(row, col, type.length, orientation);

    for (var i = 0; i < cells.length; i++) {
      if (!inBounds(cells[i].row, cells[i].col)) {
        return {
          valid: false,
          reason: type.name + ' (' + type.length + ') does not fit here — it would extend past the edge of the grid.',
          cells: cells
        };
      }
    }

    for (var j = 0; j < cells.length; j++) {
      var occupant = board.grid[cells[j].row][cells[j].col];
      if (occupant) {
        var other = getShipType(occupant);
        return {
          valid: false,
          reason: type.name + ' would overlap ' + (other ? other.name : occupant) +
            ' at ' + coordLabel(cells[j].row, cells[j].col) + '.',
          cells: cells
        };
      }
    }

    return { valid: true, reason: null, cells: cells };
  }

  /**
   * Places a ship if the placement is valid. Mutates and returns a result:
   * { success: boolean, reason: string|null }.
   */
  function placeShip(board, shipId, row, col, orientation) {
    var result = validatePlacement(board, shipId, row, col, orientation);
    if (!result.valid) {
      return { success: false, reason: result.reason };
    }
    for (var i = 0; i < result.cells.length; i++) {
      board.grid[result.cells[i].row][result.cells[i].col] = shipId;
    }
    board.ships[shipId] = {
      id: shipId,
      row: row,
      col: col,
      orientation: orientation,
      length: getShipType(shipId).length,
      cells: result.cells,
      hits: 0
    };
    return { success: true, reason: null };
  }

  function removeShip(board, shipId) {
    var placed = board.ships[shipId];
    if (!placed) return false;
    for (var i = 0; i < placed.cells.length; i++) {
      board.grid[placed.cells[i].row][placed.cells[i].col] = null;
    }
    delete board.ships[shipId];
    return true;
  }

  /**
   * Empties a board in place. Boards are reused between games, so the
   * opponent's memory of this board is dropped along with the shots it was
   * derived from.
   */
  function clearBoard(board) {
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        board.grid[row][col] = null;
        board.shots[row][col] = null;
      }
    }
    board.ships = {};
    forgetOpponentMemory(board);
    return board;
  }

  function placedShipIds(board) {
    return Object.keys(board.ships);
  }

  function allShipsPlaced(board) {
    for (var i = 0; i < SHIP_TYPES.length; i++) {
      if (!board.ships[SHIP_TYPES[i].id]) return false;
    }
    return true;
  }

  /**
   * Clears the board and places every ship at a random valid position.
   * `rng` defaults to Math.random so tests can inject a deterministic source.
   * Returns true when the full fleet was placed.
   */
  function placeFleetRandomly(board, rng) {
    var random = rng || Math.random;
    var attemptsPerFleet = 200;

    for (var attempt = 0; attempt < attemptsPerFleet; attempt++) {
      clearBoard(board);
      var ok = true;

      for (var i = 0; i < SHIP_TYPES.length; i++) {
        if (!placeShipRandomly(board, SHIP_TYPES[i].id, random)) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    clearBoard(board);
    return false;
  }

  function placeShipRandomly(board, shipId, rng) {
    var random = rng || Math.random;
    var type = getShipType(shipId);
    var options = [];

    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        if (validatePlacement(board, shipId, row, col, ORIENTATIONS.HORIZONTAL).valid) {
          options.push({ row: row, col: col, orientation: ORIENTATIONS.HORIZONTAL });
        }
        if (type.length > 1 &&
            validatePlacement(board, shipId, row, col, ORIENTATIONS.VERTICAL).valid) {
          options.push({ row: row, col: col, orientation: ORIENTATIONS.VERTICAL });
        }
      }
    }

    if (!options.length) return false;
    var pick = options[Math.floor(random() * options.length)];
    return placeShip(board, shipId, pick.row, pick.col, pick.orientation).success;
  }

  var SHOT = { HIT: 'hit', MISS: 'miss' };

  /** True when the square is on the board and has not been fired on yet. */
  function canFireAt(board, row, col) {
    return inBounds(row, col) && board.shots[row][col] === null;
  }

  function isShipSunk(board, shipId) {
    var ship = board.ships[shipId];
    return Boolean(ship) && ship.hits >= ship.length;
  }

  function sunkShipIds(board) {
    return placedShipIds(board).filter(function (shipId) {
      return isShipSunk(board, shipId);
    });
  }

  /** True when the whole fleet is placed and every ship is sunk. */
  function isFleetDefeated(board) {
    if (!allShipsPlaced(board)) return false;
    for (var i = 0; i < SHIP_TYPES.length; i++) {
      if (!isShipSunk(board, SHIP_TYPES[i].id)) return false;
    }
    return true;
  }

  /**
   * Fires at a square of `board`.
   * Returns { legal, result, shipId, shipName, sunk, fleetDefeated }.
   * An illegal shot (off board or already fired on) changes nothing and
   * reports legal: false.
   */
  function fireAt(board, row, col) {
    if (!canFireAt(board, row, col)) {
      return {
        legal: false, result: null, shipId: null, shipName: null,
        sunk: false, fleetDefeated: false
      };
    }

    var shipId = board.grid[row][col];
    if (!shipId) {
      board.shots[row][col] = SHOT.MISS;
      return {
        legal: true, result: SHOT.MISS, shipId: null, shipName: null,
        sunk: false, fleetDefeated: false
      };
    }

    board.shots[row][col] = SHOT.HIT;
    board.ships[shipId].hits += 1;
    return {
      legal: true,
      result: SHOT.HIT,
      shipId: shipId,
      shipName: getShipType(shipId).name,
      sunk: isShipSunk(board, shipId),
      fleetDefeated: isFleetDefeated(board)
    };
  }

  /** Squares of `board` that have not been fired on yet. */
  function availableTargets(board) {
    var targets = [];
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        if (board.shots[row][col] === null) targets.push({ row: row, col: col });
      }
    }
    return targets;
  }

  /** Uniformly random un-fired square: the opponent's hunt-mode strategy. */
  function chooseRandomTarget(board, rng) {
    var random = rng || Math.random;
    var targets = availableTargets(board);
    if (!targets.length) return null;
    return targets[Math.floor(random() * targets.length)];
  }

  /* ---------- hunt-and-target opponent ----------
   *
   * The opponent knows only what a human opponent would: which squares it has
   * fired on, whether each was a hit or a miss, and which ships have been
   * announced sunk (with their published lengths). It never reads ship
   * positions. That knowledge is rebuilt from `board.shots` on every call and
   * cached per board, so the public signature stays
   * `chooseOpponentTarget(board, rng)`.
   */

  var DIRECTIONS = [
    { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
  ];

  var opponentMemory = new WeakMap();

  function cellKey(row, col) {
    return row + ',' + col;
  }

  function newMemory() {
    return { fired: {}, openHits: [], queue: [], sunkSeen: {} };
  }

  /** A board whose shots were cleared (New Game) invalidates past memory. */
  function memoryIsStale(board, memory) {
    for (var key in memory.fired) {
      if (!Object.prototype.hasOwnProperty.call(memory.fired, key)) continue;
      var parts = key.split(',');
      if (board.shots[Number(parts[0])][Number(parts[1])] === null) return true;
    }
    return false;
  }

  function forgetOpponentMemory(board) {
    opponentMemory['delete'](board);
  }

  function memoryFor(board) {
    var memory = opponentMemory.get(board);
    if (!memory || memoryIsStale(board, memory)) {
      memory = newMemory();
      opponentMemory.set(board, memory);
    }
    return memory;
  }

  function enqueueNeighbors(board, memory, hit) {
    DIRECTIONS.forEach(function (dir) {
      var row = hit.row + dir.dr;
      var col = hit.col + dir.dc;
      if (!canFireAt(board, row, col)) return;

      var key = cellKey(row, col);
      for (var i = 0; i < memory.queue.length; i++) {
        if (memory.queue[i].key === key) {
          memory.queue[i].origins[cellKey(hit.row, hit.col)] = true;
          return;
        }
      }
      var origins = {};
      origins[cellKey(hit.row, hit.col)] = true;
      memory.queue.push({ key: key, row: row, col: col, origins: origins });
    });
  }

  /** Folds any shots taken since the last call into the opponent's memory. */
  function recordShots(board, memory) {
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        var shot = board.shots[row][col];
        var key = cellKey(row, col);
        if (!shot || memory.fired[key]) continue;

        memory.fired[key] = shot;
        if (shot === SHOT.HIT) {
          var hit = { row: row, col: col, key: key };
          memory.openHits.push(hit);
          enqueueNeighbors(board, memory, hit);
        }
      }
    }
  }

  function findOpenHit(memory, row, col) {
    for (var i = 0; i < memory.openHits.length; i++) {
      if (memory.openHits[i].row === row && memory.openHits[i].col === col) {
        return memory.openHits[i];
      }
    }
    return null;
  }

  /** The straight run of open hits through `hit` along one axis. */
  function runThrough(memory, hit, dr, dc) {
    var run = [hit];
    var step;
    var next;
    for (step = 1; ; step++) {
      next = findOpenHit(memory, hit.row + dr * step, hit.col + dc * step);
      if (!next) break;
      run.push(next);
    }
    for (step = 1; ; step++) {
      next = findOpenHit(memory, hit.row - dr * step, hit.col - dc * step);
      if (!next) break;
      run.unshift(next);
    }
    return run;
  }

  /**
   * A ship of `length` was announced sunk. Attribute that many open hits to
   * it — the straight run that fits it, newest hits first — and retire only
   * the queued squares that came from those hits. Hits on a different,
   * still-floating ship (adjacent ships are the awkward case) stay open, so
   * the opponent keeps hunting it instead of falling back to random fire.
   */
  function resolveSunkShip(memory, length) {
    var candidates = [];
    for (var i = memory.openHits.length - 1; i >= 0; i--) {
      var hit = memory.openHits[i];
      candidates.push(runThrough(memory, hit, 0, 1));
      candidates.push(runThrough(memory, hit, 1, 0));
      candidates.push([hit]);
    }

    var chosen = null;
    for (var c = 0; c < candidates.length && !chosen; c++) {
      if (candidates[c].length === length) chosen = candidates[c];
    }
    if (!chosen) {
      for (var d = 0; d < candidates.length && !chosen; d++) {
        if (candidates[d].length > length) chosen = candidates[d].slice(-length);
      }
    }
    if (!chosen) chosen = memory.openHits.slice(-length);
    if (!chosen.length) return;

    var retired = {};
    chosen.forEach(function (hit) {
      retired[hit.key] = true;
    });

    memory.openHits = memory.openHits.filter(function (hit) {
      return !retired[hit.key];
    });

    memory.queue = memory.queue.filter(function (entry) {
      return Object.keys(entry.origins).some(function (origin) {
        return !retired[origin];
      });
    });
  }

  function recordSinks(board, memory) {
    sunkShipIds(board).forEach(function (shipId) {
      if (memory.sunkSeen[shipId]) return;
      memory.sunkSeen[shipId] = true;
      resolveSunkShip(memory, getShipType(shipId).length);
    });
  }

  /**
   * True when firing here extends a line of two or more known hits. Ships are
   * straight, so continuing a confirmed axis beats a perpendicular neighbor.
   */
  function extendsKnownLine(memory, entry) {
    return DIRECTIONS.some(function (dir) {
      return findOpenHit(memory, entry.row - dir.dr, entry.col - dir.dc) &&
        findOpenHit(memory, entry.row - dir.dr * 2, entry.col - dir.dc * 2);
    });
  }

  function takeFromQueue(board, memory, random) {
    memory.queue = memory.queue.filter(function (entry) {
      return canFireAt(board, entry.row, entry.col);
    });
    if (!memory.queue.length) return null;

    var preferred = memory.queue.filter(function (entry) {
      return extendsKnownLine(memory, entry);
    });
    var pool = preferred.length ? preferred : memory.queue;
    var pick = pool[Math.floor(random() * pool.length)];

    // The pick stays queued until it has actually been fired on: the filter
    // above retires it once the shot lands, so calling this more than once
    // per turn cannot silently drop a target.
    return { row: pick.row, col: pick.col };
  }

  /**
   * Opponent targeting. Takes the board being fired upon and returns a
   * coordinate { row, col }, or null when no square is left. `rng` is
   * optional and defaults to Math.random, matching `placeFleetRandomly`.
   *
   * Hunt-and-target: fire from the queue of squares around unresolved hits
   * when it is non-empty, otherwise fire at a uniformly random un-fired
   * square. Turn handling and rendering do not depend on how the coordinate
   * is chosen.
   */
  function chooseOpponentTarget(board, rng) {
    var random = rng || Math.random;
    var memory = memoryFor(board);

    recordShots(board, memory);
    recordSinks(board, memory);

    return takeFromQueue(board, memory, random) || chooseRandomTarget(board, random);
  }

  function toggleOrientation(orientation) {
    return orientation === ORIENTATIONS.HORIZONTAL
      ? ORIENTATIONS.VERTICAL
      : ORIENTATIONS.HORIZONTAL;
  }

  var Battleship = {
    BOARD_SIZE: BOARD_SIZE,
    ROW_LABELS: ROW_LABELS,
    SHIP_TYPES: SHIP_TYPES,
    ORIENTATIONS: ORIENTATIONS,
    createBoard: createBoard,
    clearBoard: clearBoard,
    inBounds: inBounds,
    getShipType: getShipType,
    shipCells: shipCells,
    coordLabel: coordLabel,
    validatePlacement: validatePlacement,
    placeShip: placeShip,
    removeShip: removeShip,
    placedShipIds: placedShipIds,
    allShipsPlaced: allShipsPlaced,
    placeShipRandomly: placeShipRandomly,
    placeFleetRandomly: placeFleetRandomly,
    SHOT: SHOT,
    canFireAt: canFireAt,
    fireAt: fireAt,
    isShipSunk: isShipSunk,
    sunkShipIds: sunkShipIds,
    isFleetDefeated: isFleetDefeated,
    availableTargets: availableTargets,
    chooseRandomTarget: chooseRandomTarget,
    chooseOpponentTarget: chooseOpponentTarget,
    forgetOpponentMemory: forgetOpponentMemory,
    toggleOrientation: toggleOrientation
  };

  root.Battleship = Battleship;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Battleship;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
