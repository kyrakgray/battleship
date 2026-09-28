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
    { id: 'carrier', name: 'Carrier', length: 5 },
    { id: 'battleship', name: 'Battleship', length: 4 },
    { id: 'cruiser', name: 'Cruiser', length: 3 },
    { id: 'submarine', name: 'Submarine', length: 3 },
    { id: 'destroyer', name: 'Destroyer', length: 2 }
  ];

  var ORIENTATIONS = { HORIZONTAL: 'horizontal', VERTICAL: 'vertical' };

  /** Creates an empty board state. `grid[row][col]` holds a ship id or null. */
  function createBoard() {
    var grid = [];
    for (var row = 0; row < BOARD_SIZE; row++) {
      var line = [];
      for (var col = 0; col < BOARD_SIZE; col++) {
        line.push(null);
      }
      grid.push(line);
    }
    return { size: BOARD_SIZE, grid: grid, ships: {} };
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
      cells: result.cells
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

  function clearBoard(board) {
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        board.grid[row][col] = null;
      }
    }
    board.ships = {};
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
    toggleOrientation: toggleOrientation
  };

  root.Battleship = Battleship;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Battleship;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
