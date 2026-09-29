/**
 * The California Five — game state.
 *
 * Hidden-placement rules under a national-parks theme: each park occupies a
 * straight run of squares on an itinerary, a turn is a scouting day, and
 * finding every square of a park stamps it in your passport.
 *
 * Pure data + logic, no DOM access. Everything here is testable in isolation
 * (node, a test runner, or the browser console).
 */
(function (root) {
  'use strict';

  var BOARD_SIZE = 10;
  var ROW_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  /**
   * The five California national parks on an itinerary. `length` is how many
   * squares the park covers; `acres` is the published size shown on the park
   * card and in the passport. `region` is descriptive only — every scouting
   * day costs one trail day.
   */
  var PARKS = [
    { id: 'death-valley', name: 'Death Valley', length: 5, acres: 3408396, region: 'desert', color: '#f0c419' },
    { id: 'joshua-tree', name: 'Joshua Tree', length: 4, acres: 795156, region: 'desert', color: '#e9762f' },
    { id: 'yosemite', name: 'Yosemite', length: 3, acres: 761748, region: 'sierra', color: '#2fa8c9' },
    { id: 'kings-canyon', name: 'Kings Canyon', length: 3, acres: 461901, region: 'sierra', color: '#8f6bd6' },
    { id: 'sequoia', name: 'Sequoia', length: 2, acres: 404063, region: 'sierra', color: '#d76ba6' }
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
   * `grid[row][col]` holds a park id or null; `days[row][col]` holds
   * 'marker' (trail marker), 'dead-end' (dead end), or null.
   */
  function createBoard() {
    return { size: BOARD_SIZE, grid: emptyGrid(), days: emptyGrid(), parks: {} };
  }

  function inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function getPark(parkId) {
    for (var i = 0; i < PARKS.length; i++) {
      if (PARKS[i].id === parkId) return PARKS[i];
    }
    return null;
  }

  /** Cells a park of `length` would occupy from an origin, ignoring validity. */
  function parkCells(row, col, length, orientation) {
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
  function validatePlacement(board, parkId, row, col, orientation) {
    var type = getPark(parkId);
    if (!type) {
      return { valid: false, reason: 'Unknown park.', cells: [] };
    }
    if (orientation !== ORIENTATIONS.HORIZONTAL && orientation !== ORIENTATIONS.VERTICAL) {
      return { valid: false, reason: 'A park must run straight across or straight down.', cells: [] };
    }
    if (board.parks[parkId]) {
      return { valid: false, reason: type.name + ' is already placed.', cells: [] };
    }

    var cells = parkCells(row, col, type.length, orientation);

    for (var i = 0; i < cells.length; i++) {
      if (!inBounds(cells[i].row, cells[i].col)) {
        return {
          valid: false,
          reason: type.name + ' (' + type.length + ') does not fit here — it would run off the edge of the map.',
          cells: cells
        };
      }
    }

    for (var j = 0; j < cells.length; j++) {
      var occupant = board.grid[cells[j].row][cells[j].col];
      if (occupant) {
        var other = getPark(occupant);
        return {
          valid: false,
          reason: type.name + ' would overlap ' + (other ? other.name : occupant) +
            ' at ' + coordLabel(cells[j].row, cells[j].col) + '. Parks cannot share a square.',
          cells: cells
        };
      }
    }

    return { valid: true, reason: null, cells: cells };
  }

  /**
   * Places a park if the placement is valid. Mutates and returns a result:
   * { success: boolean, reason: string|null }.
   */
  function placePark(board, parkId, row, col, orientation) {
    var result = validatePlacement(board, parkId, row, col, orientation);
    if (!result.valid) {
      return { success: false, reason: result.reason };
    }
    for (var i = 0; i < result.cells.length; i++) {
      board.grid[result.cells[i].row][result.cells[i].col] = parkId;
    }
    board.parks[parkId] = {
      id: parkId,
      row: row,
      col: col,
      orientation: orientation,
      length: getPark(parkId).length,
      cells: result.cells,
      found: 0
    };
    return { success: true, reason: null };
  }

  function removePark(board, parkId) {
    var placed = board.parks[parkId];
    if (!placed) return false;
    for (var i = 0; i < placed.cells.length; i++) {
      board.grid[placed.cells[i].row][placed.cells[i].col] = null;
    }
    delete board.parks[parkId];
    return true;
  }

  /**
   * Empties a board in place. Boards are reused between games, so the
   * rival's memory of this board is dropped along with the days it was
   * derived from.
   */
  function clearBoard(board) {
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        board.grid[row][col] = null;
        board.days[row][col] = null;
      }
    }
    board.parks = {};
    forgetRivalMemory(board);
    return board;
  }

  function placedParkIds(board) {
    return Object.keys(board.parks);
  }

  function allParksPlaced(board) {
    for (var i = 0; i < PARKS.length; i++) {
      if (!board.parks[PARKS[i].id]) return false;
    }
    return true;
  }

  /**
   * Clears the board and places every park at a random valid position.
   * `rng` defaults to Math.random so tests can inject a deterministic source.
   * Returns true when all five parks were placed.
   */
  function placeRouteRandomly(board, rng) {
    var random = rng || Math.random;
    var attemptsPerRoute = 200;

    for (var attempt = 0; attempt < attemptsPerRoute; attempt++) {
      clearBoard(board);
      var ok = true;

      for (var i = 0; i < PARKS.length; i++) {
        if (!placeParkRandomly(board, PARKS[i].id, random)) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    clearBoard(board);
    return false;
  }

  function placeParkRandomly(board, parkId, rng) {
    var random = rng || Math.random;
    var type = getPark(parkId);
    var options = [];

    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        if (validatePlacement(board, parkId, row, col, ORIENTATIONS.HORIZONTAL).valid) {
          options.push({ row: row, col: col, orientation: ORIENTATIONS.HORIZONTAL });
        }
        if (type.length > 1 &&
            validatePlacement(board, parkId, row, col, ORIENTATIONS.VERTICAL).valid) {
          options.push({ row: row, col: col, orientation: ORIENTATIONS.VERTICAL });
        }
      }
    }

    if (!options.length) return false;
    var pick = options[Math.floor(random() * options.length)];
    return placePark(board, parkId, pick.row, pick.col, pick.orientation).success;
  }

  var DAY = { TRAIL_MARKER: 'marker', DEAD_END: 'dead-end' };

  /**
   * Tioga Pass opened late on the fourth of July and closes 100 days later,
   * so a season is 100 trail days — one per square of the map.
   */
  var SEASON_DAYS = BOARD_SIZE * BOARD_SIZE;

  /** Trail day 1 is the fourth of July, the morning the pass opened. */
  var SEASON_START = { year: 2026, month: 6, day: 4 };
  var MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday',
    'Friday', 'Saturday'];

  /** The calendar date of a trail day, counting from the fourth of July. */
  function seasonDate(dayNumber) {
    var day = Math.max(1, Math.min(SEASON_DAYS, dayNumber));
    return new Date(Date.UTC(
      SEASON_START.year, SEASON_START.month, SEASON_START.day + day - 1
    ));
  }

  /** Calendar fields for a trail day, ready to drop into the page. */
  function seasonDateParts(dayNumber) {
    var date = seasonDate(dayNumber);
    var dayOfMonth = date.getUTCDate();
    return {
      weekday: WEEKDAY_NAMES[date.getUTCDay()],
      month: MONTH_NAMES[date.getUTCMonth()],
      day: dayOfMonth,
      paddedDay: (dayOfMonth < 10 ? '0' : '') + dayOfMonth,
      year: date.getUTCFullYear()
    };
  }

  /** Date line inked into a passport stamp, e.g. "JUL 09 2026". */
  function stampDateLabel(dayNumber) {
    var parts = seasonDateParts(dayNumber);
    return parts.month + ' ' + parts.paddedDay + ' ' + parts.year;
  }

  /** True when the square is on the board and has not been scouted yet. */
  function canScout(board, row, col) {
    return inBounds(row, col) && board.days[row][col] === null;
  }

  /** A park is stamped once every one of its squares has been found. */
  function isParkStamped(board, parkId) {
    var park = board.parks[parkId];
    return Boolean(park) && park.found >= park.length;
  }

  function stampedParkIds(board) {
    return placedParkIds(board).filter(function (parkId) {
      return isParkStamped(board, parkId);
    });
  }

  /** True when all five parks are placed and every one of them is stamped. */
  function isRouteComplete(board) {
    if (!allParksPlaced(board)) return false;
    for (var i = 0; i < PARKS.length; i++) {
      if (!isParkStamped(board, PARKS[i].id)) return false;
    }
    return true;
  }

  /**
   * Spends a scouting day on a square of `board`.
   * Returns { legal, result, parkId, parkName, stamped, routeComplete }.
   * An illegal day (off the map or already scouted) changes nothing and
   * reports legal: false.
   */
  function scout(board, row, col) {
    if (!canScout(board, row, col)) {
      return {
        legal: false, result: null, parkId: null, parkName: null,
        stamped: false, routeComplete: false
      };
    }

    var parkId = board.grid[row][col];
    if (!parkId) {
      board.days[row][col] = DAY.DEAD_END;
      return {
        legal: true, result: DAY.DEAD_END, parkId: null, parkName: null,
        stamped: false, routeComplete: false
      };
    }

    board.days[row][col] = DAY.TRAIL_MARKER;
    board.parks[parkId].found += 1;
    var stamped = isParkStamped(board, parkId);
    // The day a park is completed is the date inked into the passport stamp.
    if (stamped && !board.parks[parkId].stampedOnDay) {
      board.parks[parkId].stampedOnDay = daysSpent(board);
    }
    return {
      legal: true,
      result: DAY.TRAIL_MARKER,
      parkId: parkId,
      parkName: getPark(parkId).name,
      stamped: stamped,
      stampedOnDay: board.parks[parkId].stampedOnDay || null,
      routeComplete: isRouteComplete(board)
    };
  }

  /** Squares of `board` that have not been scouted yet. */
  function unscoutedSquares(board) {
    var squares = [];
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        if (board.days[row][col] === null) squares.push({ row: row, col: col });
      }
    }
    return squares;
  }

  /** Trail days already spent on this map, out of `SEASON_DAYS`. */
  function daysSpent(board) {
    return SEASON_DAYS - unscoutedSquares(board).length;
  }

  /** Trail days left before Tioga Pass closes for the winter. */
  function daysLeft(board) {
    return unscoutedSquares(board).length;
  }

  /** Uniformly random unscouted square: the rival's roaming strategy. */
  function chooseRandomSquare(board, rng) {
    var random = rng || Math.random;
    var squares = unscoutedSquares(board);
    if (!squares.length) return null;
    return squares[Math.floor(random() * squares.length)];
  }

  /* ---------- roam-and-follow rival ----------
   *
   * The rival knows only what a human rival would: which squares it has
   * scouted, whether each was a trail marker or a dead end, and which parks
   * have been announced stamped (with their published sizes). It never reads
   * park positions. That knowledge is rebuilt from `board.days` on every call and
   * cached per board, so the public signature stays
   * `chooseRivalSquare(board, rng)`.
   */

  var DIRECTIONS = [
    { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }
  ];

  var rivalMemory = new WeakMap();

  function cellKey(row, col) {
    return row + ',' + col;
  }

  function newMemory() {
    return { scouted: {}, openMarkers: [], queue: [], stampedSeen: {} };
  }

  /** A board whose days were cleared (New Season) invalidates past memory. */
  function memoryIsStale(board, memory) {
    for (var key in memory.scouted) {
      if (!Object.prototype.hasOwnProperty.call(memory.scouted, key)) continue;
      var parts = key.split(',');
      if (board.days[Number(parts[0])][Number(parts[1])] === null) return true;
    }
    return false;
  }

  function forgetRivalMemory(board) {
    rivalMemory['delete'](board);
  }

  function memoryFor(board) {
    var memory = rivalMemory.get(board);
    if (!memory || memoryIsStale(board, memory)) {
      memory = newMemory();
      rivalMemory.set(board, memory);
    }
    return memory;
  }

  function enqueueNeighbors(board, memory, marker) {
    DIRECTIONS.forEach(function (dir) {
      var row = marker.row + dir.dr;
      var col = marker.col + dir.dc;
      if (!canScout(board, row, col)) return;

      var key = cellKey(row, col);
      for (var i = 0; i < memory.queue.length; i++) {
        if (memory.queue[i].key === key) {
          memory.queue[i].origins[cellKey(marker.row, marker.col)] = true;
          return;
        }
      }
      var origins = {};
      origins[cellKey(marker.row, marker.col)] = true;
      memory.queue.push({ key: key, row: row, col: col, origins: origins });
    });
  }

  /** Folds any days taken since the last call into the rival's memory. */
  function recordDays(board, memory) {
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        var day = board.days[row][col];
        var key = cellKey(row, col);
        if (!day || memory.scouted[key]) continue;

        memory.scouted[key] = day;
        if (day === DAY.TRAIL_MARKER) {
          var marker = { row: row, col: col, key: key };
          memory.openMarkers.push(marker);
          enqueueNeighbors(board, memory, marker);
        }
      }
    }
  }

  function findOpenMarker(memory, row, col) {
    for (var i = 0; i < memory.openMarkers.length; i++) {
      if (memory.openMarkers[i].row === row && memory.openMarkers[i].col === col) {
        return memory.openMarkers[i];
      }
    }
    return null;
  }

  /** The straight run of markers through `marker` along one axis. */
  function runThrough(memory, marker, dr, dc) {
    var run = [marker];
    var step;
    var next;
    for (step = 1; ; step++) {
      next = findOpenMarker(memory, marker.row + dr * step, marker.col + dc * step);
      if (!next) break;
      run.push(next);
    }
    for (step = 1; ; step++) {
      next = findOpenMarker(memory, marker.row - dr * step, marker.col - dc * step);
      if (!next) break;
      run.unshift(next);
    }
    return run;
  }

  /**
   * A park of `length` was announced stamped. Attribute that many markers
   * to it — the straight run that fits it, newest markers first — and retire
   * only the queued squares that came from those markers. Markers on a
   * different, still-unstamped park (adjacent parks are the awkward case)
   * stay open, so the rival keeps working it instead of roaming at random.
   */
  function resolveStampedPark(memory, length) {
    var candidates = [];
    for (var i = memory.openMarkers.length - 1; i >= 0; i--) {
      var marker = memory.openMarkers[i];
      candidates.push(runThrough(memory, marker, 0, 1));
      candidates.push(runThrough(memory, marker, 1, 0));
      candidates.push([marker]);
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
    if (!chosen) chosen = memory.openMarkers.slice(-length);
    if (!chosen.length) return;

    var retired = {};
    chosen.forEach(function (marker) {
      retired[marker.key] = true;
    });

    memory.openMarkers = memory.openMarkers.filter(function (marker) {
      return !retired[marker.key];
    });

    memory.queue = memory.queue.filter(function (entry) {
      return Object.keys(entry.origins).some(function (origin) {
        return !retired[origin];
      });
    });
  }

  function recordStamps(board, memory) {
    stampedParkIds(board).forEach(function (parkId) {
      if (memory.stampedSeen[parkId]) return;
      memory.stampedSeen[parkId] = true;
      resolveStampedPark(memory, getPark(parkId).length);
    });
  }

  /**
   * True when scouting here extends a line of two or more known markers.
   * Parks are straight, so continuing a confirmed axis beats a perpendicular
   * neighbor.
   */
  function extendsKnownLine(memory, entry) {
    return DIRECTIONS.some(function (dir) {
      return findOpenMarker(memory, entry.row - dir.dr, entry.col - dir.dc) &&
        findOpenMarker(memory, entry.row - dir.dr * 2, entry.col - dir.dc * 2);
    });
  }

  function takeFromQueue(board, memory, random) {
    memory.queue = memory.queue.filter(function (entry) {
      return canScout(board, entry.row, entry.col);
    });
    if (!memory.queue.length) return null;

    var preferred = memory.queue.filter(function (entry) {
      return extendsKnownLine(memory, entry);
    });
    var pool = preferred.length ? preferred : memory.queue;
    var pick = pool[Math.floor(random() * pool.length)];

    // The pick stays queued until it has actually been scouted: the filter
    // above retires it once the day is spent, so calling this more than once
    // per turn cannot silently drop a square.
    return { row: pick.row, col: pick.col };
  }

  /**
   * Where the rival spends its next scouting day. Takes the board being
   * scouted and returns a coordinate { row, col }, or null when no square is
   * left. `rng` is optional and defaults to Math.random, matching
   * `placeRouteRandomly`.
   *
   * Roam-and-follow: scout from the queue of squares around unresolved trail
   * markers while it is non-empty, otherwise pick a uniformly random
   * unscouted square. Turn handling and rendering do not depend on how the
   * coordinate is chosen.
   */
  function chooseRivalSquare(board, rng) {
    var random = rng || Math.random;
    var memory = memoryFor(board);

    recordDays(board, memory);
    recordStamps(board, memory);

    return takeFromQueue(board, memory, random) || chooseRandomSquare(board, random);
  }

  function toggleOrientation(orientation) {
    return orientation === ORIENTATIONS.HORIZONTAL
      ? ORIENTATIONS.VERTICAL
      : ORIENTATIONS.HORIZONTAL;
  }

  var CaliforniaFive = {
    BOARD_SIZE: BOARD_SIZE,
    ROW_LABELS: ROW_LABELS,
    PARKS: PARKS,
    ORIENTATIONS: ORIENTATIONS,
    createBoard: createBoard,
    clearBoard: clearBoard,
    inBounds: inBounds,
    getPark: getPark,
    parkCells: parkCells,
    coordLabel: coordLabel,
    validatePlacement: validatePlacement,
    placePark: placePark,
    removePark: removePark,
    placedParkIds: placedParkIds,
    allParksPlaced: allParksPlaced,
    placeParkRandomly: placeParkRandomly,
    placeRouteRandomly: placeRouteRandomly,
    DAY: DAY,
    SEASON_DAYS: SEASON_DAYS,
    SEASON_START: SEASON_START,
    seasonDate: seasonDate,
    seasonDateParts: seasonDateParts,
    stampDateLabel: stampDateLabel,
    canScout: canScout,
    daysSpent: daysSpent,
    daysLeft: daysLeft,
    scout: scout,
    isParkStamped: isParkStamped,
    stampedParkIds: stampedParkIds,
    isRouteComplete: isRouteComplete,
    unscoutedSquares: unscoutedSquares,
    chooseRandomSquare: chooseRandomSquare,
    chooseRivalSquare: chooseRivalSquare,
    forgetRivalMemory: forgetRivalMemory,
    toggleOrientation: toggleOrientation
  };

  root.CaliforniaFive = CaliforniaFive;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CaliforniaFive;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
