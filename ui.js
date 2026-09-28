/** Rendering and event wiring. All game rules live in game.js. */
(function () {
  'use strict';

  var B = window.Battleship;

  var PHASES = { PLACEMENT: 'placement', PLAYER_TURN: 'player-turn', OPPONENT_TURN: 'opponent-turn', OVER: 'over' };
  var OPPONENT_DELAY_MS = 600;
  var LOG_LIMIT = 8;

  var state = {
    phase: PHASES.PLACEMENT,
    playerBoard: B.createBoard(),
    enemyBoard: B.createBoard(),
    selectedShipId: B.SHIP_TYPES[0].id,
    orientation: B.ORIENTATIONS.HORIZONTAL,
    hover: null,
    log: [],
    winner: null,
    revealEnemy: false
  };

  var els = {
    phaseLabel: document.getElementById('phase-label'),
    playerBoard: document.getElementById('player-board'),
    enemyBoard: document.getElementById('enemy-board'),
    fleetList: document.getElementById('fleet-list'),
    message: document.getElementById('message'),
    orientationLabel: document.getElementById('orientation-label'),
    placementControls: document.getElementById('placement-controls'),
    battleControls: document.getElementById('battle-controls'),
    btnRandom: document.getElementById('btn-random'),
    btnReset: document.getElementById('btn-reset'),
    btnStart: document.getElementById('btn-start'),
    btnNewGame: document.getElementById('btn-new-game'),
    btnReveal: document.getElementById('btn-reveal'),
    statusPlayer: document.getElementById('status-player'),
    statusEnemy: document.getElementById('status-enemy'),
    log: document.getElementById('log')
  };

  var playerCells = {};
  var enemyCells = {};

  function cellKey(row, col) {
    return row + ',' + col;
  }

  function buildGrid(container, cellMap) {
    container.innerHTML = '';
    var corner = document.createElement('div');
    corner.className = 'label';
    container.appendChild(corner);

    for (var c = 0; c < B.BOARD_SIZE; c++) {
      var colLabel = document.createElement('div');
      colLabel.className = 'label';
      colLabel.textContent = String(c + 1);
      container.appendChild(colLabel);
    }

    for (var row = 0; row < B.BOARD_SIZE; row++) {
      var rowLabel = document.createElement('div');
      rowLabel.className = 'label';
      rowLabel.textContent = B.ROW_LABELS[row];
      container.appendChild(rowLabel);

      for (var col = 0; col < B.BOARD_SIZE; col++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        cell.title = B.coordLabel(row, col);
        container.appendChild(cell);
        cellMap[cellKey(row, col)] = cell;
      }
    }
  }

  function renderFleet() {
    els.fleetList.innerHTML = '';
    B.SHIP_TYPES.forEach(function (type) {
      var placed = Boolean(state.playerBoard.ships[type.id]);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.setProperty('--ship-color', type.color);
      btn.className = 'ship-btn' +
        (state.selectedShipId === type.id ? ' selected' : '') +
        (placed ? ' placed' : '');
      btn.dataset.shipId = type.id;

      var label = document.createElement('span');
      label.textContent = type.name + ' (' + type.length + ')';
      btn.appendChild(label);

      var pips = document.createElement('span');
      pips.className = 'pips';
      for (var i = 0; i < type.length; i++) {
        var pip = document.createElement('span');
        pip.className = 'pip';
        pip.style.background = type.color;
        pips.appendChild(pip);
      }
      btn.appendChild(pips);

      btn.addEventListener('click', function () {
        selectShip(type.id);
      });
      els.fleetList.appendChild(btn);
    });
  }

  /** Player grid: own ships plus the shots the opponent has taken at them. */
  function renderPlayerBoard() {
    for (var row = 0; row < B.BOARD_SIZE; row++) {
      for (var col = 0; col < B.BOARD_SIZE; col++) {
        var cell = playerCells[cellKey(row, col)];
        var shipId = state.playerBoard.grid[row][col];
        var shot = state.playerBoard.shots[row][col];
        cell.className = 'cell' + (shipId ? ' ship' : '') +
          (shot ? ' ' + shot : '');
        cell.style.background = shipId && !shot ? B.getShipType(shipId).color : '';
      }
    }
    renderPreview();
  }

  /**
   * Enemy grid: shots only, so opponent ship positions never reach the DOM —
   * except once the game is over and the player asks to reveal them.
   */
  function renderEnemyBoard() {
    for (var row = 0; row < B.BOARD_SIZE; row++) {
      for (var col = 0; col < B.BOARD_SIZE; col++) {
        var cell = enemyCells[cellKey(row, col)];
        var shot = state.enemyBoard.shots[row][col];
        var shipId = state.revealEnemy ? state.enemyBoard.grid[row][col] : null;
        var reveal = Boolean(shipId) && shot !== B.SHOT.HIT;
        cell.className = 'cell' + (shot ? ' ' + shot : '') + (reveal ? ' revealed' : '');
        cell.style.background = reveal ? B.getShipType(shipId).color : '';
      }
    }
    els.enemyBoard.classList.toggle('disabled', state.phase !== PHASES.PLAYER_TURN);
    els.enemyBoard.setAttribute('aria-disabled', String(state.phase !== PHASES.PLAYER_TURN));
  }

  function renderPreview() {
    if (state.phase !== PHASES.PLACEMENT) return;
    if (!state.hover || !state.selectedShipId) return;
    if (state.playerBoard.ships[state.selectedShipId]) return;

    var type = B.getShipType(state.selectedShipId);
    var result = B.validatePlacement(
      state.playerBoard, state.selectedShipId, state.hover.row, state.hover.col, state.orientation
    );
    var cells = B.shipCells(state.hover.row, state.hover.col, type.length, state.orientation);

    cells.forEach(function (pos) {
      var cell = playerCells[cellKey(pos.row, pos.col)];
      if (!cell) return;
      cell.classList.add(result.valid ? 'preview-valid' : 'preview-invalid');
      cell.style.background = '';
    });
  }

  function renderFleetStatus() {
    [
      { list: els.statusPlayer, board: state.playerBoard },
      { list: els.statusEnemy, board: state.enemyBoard }
    ].forEach(function (side) {
      side.list.innerHTML = '';
      B.SHIP_TYPES.forEach(function (type) {
        var item = document.createElement('li');
        var sunk = B.isShipSunk(side.board, type.id);
        item.className = 'status-ship' + (sunk ? ' sunk' : '');

        var swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.style.background = type.color;
        item.appendChild(swatch);

        var name = document.createElement('span');
        name.textContent = type.name + ' (' + type.length + ')' + (sunk ? ' — sunk' : '');
        item.appendChild(name);

        side.list.appendChild(item);
      });
    });
  }

  function renderLog() {
    els.log.innerHTML = '';
    state.log.slice(-LOG_LIMIT).forEach(function (entry) {
      var item = document.createElement('li');
      item.className = 'log-entry ' + entry.side;
      item.textContent = entry.text;
      els.log.appendChild(item);
    });
  }

  function addLog(side, text) {
    state.log.push({ side: side, text: text });
    renderLog();
  }

  function setMessage(text, kind) {
    els.message.textContent = text || '';
    els.message.className = 'message' + (kind ? ' ' + kind : '');
  }

  function setPhase(phase) {
    state.phase = phase;
    var placing = phase === PHASES.PLACEMENT;
    els.playerBoard.classList.toggle('disabled', !placing);
    els.placementControls.classList.toggle('hidden', !placing);
    els.battleControls.classList.toggle('hidden', placing);
    els.phaseLabel.textContent =
      placing ? 'Ship placement phase'
        : phase === PHASES.OVER ? 'Game over'
          : phase === PHASES.PLAYER_TURN ? 'Your turn — fire at Enemy Waters'
            : 'Opponent is taking their turn…';
    renderEnemyBoard();
  }

  function render() {
    renderFleet();
    renderPlayerBoard();
    renderEnemyBoard();
    renderFleetStatus();
    renderLog();
  }

  /* ---------- placement phase ---------- */

  function firstUnplacedShipId() {
    for (var i = 0; i < B.SHIP_TYPES.length; i++) {
      if (!state.playerBoard.ships[B.SHIP_TYPES[i].id]) return B.SHIP_TYPES[i].id;
    }
    return null;
  }

  function selectShip(shipId) {
    state.selectedShipId = shipId;
    if (state.playerBoard.ships[shipId]) {
      setMessage(B.getShipType(shipId).name + ' is already placed. Use Reset Placement to start over.', 'error');
    } else {
      setMessage('');
    }
    renderFleet();
    renderPlayerBoard();
  }

  function updateStartButton() {
    els.btnStart.disabled = !B.allShipsPlaced(state.playerBoard);
  }

  function handlePlacementClick(row, col) {
    var shipId = state.selectedShipId;
    if (!shipId || state.playerBoard.ships[shipId]) {
      var next = firstUnplacedShipId();
      if (!next) {
        setMessage('All ships are placed. Press Start Game.', 'info');
        return;
      }
      shipId = next;
      state.selectedShipId = next;
    }

    var result = B.placeShip(state.playerBoard, shipId, row, col, state.orientation);
    if (!result.success) {
      setMessage(result.reason, 'error');
      renderFleet();
      renderPlayerBoard();
      return;
    }

    setMessage(B.getShipType(shipId).name + ' placed at ' + B.coordLabel(row, col) + '.', 'info');
    state.selectedShipId = firstUnplacedShipId();
    renderFleet();
    renderPlayerBoard();
    updateStartButton();
    if (!state.selectedShipId) setMessage('Fleet ready. Press Start Game.', 'info');
  }

  function setOrientation(orientation) {
    state.orientation = orientation;
    els.orientationLabel.textContent =
      orientation === B.ORIENTATIONS.HORIZONTAL ? 'Horizontal' : 'Vertical';
    renderPlayerBoard();
  }

  /* ---------- battle phase ---------- */

  function describeShot(shooter, row, col, result) {
    var where = B.coordLabel(row, col);
    if (result.result === B.SHOT.MISS) {
      return (shooter === 'player' ? 'You fired at ' : 'Opponent fired at ') + where + '. Miss.';
    }
    var hit = (shooter === 'player' ? 'You fired at ' : 'Opponent fired at ') +
      where + '. Hit. ' + result.shipName + '.';
    if (result.sunk) {
      hit += shooter === 'player'
        ? ' You sank my ' + result.shipName + '!'
        : ' Opponent sank your ' + result.shipName + '!';
    }
    return hit;
  }

  function startGame() {
    if (!B.allShipsPlaced(state.playerBoard)) return;
    B.clearBoard(state.enemyBoard);
    B.placeFleetRandomly(state.enemyBoard);
    state.hover = null;
    state.winner = null;
    state.revealEnemy = false;
    state.log = [];
    els.btnReveal.classList.add('hidden');
    addLog('system', 'Battle stations. You have the first shot.');
    setPhase(PHASES.PLAYER_TURN);
    setMessage('Your turn. Fire at Enemy Waters.', 'info');
    render();
  }

  function endGame(winner) {
    state.winner = winner;
    setPhase(PHASES.OVER);
    var text = winner === 'player'
      ? 'You win! The enemy fleet is sunk.'
      : 'You lose. Your fleet is sunk.';
    addLog('system', text);
    setMessage(text, winner === 'player' ? 'info' : 'error');
    els.btnReveal.classList.toggle('hidden', winner === 'player');
    els.btnReveal.textContent = 'Reveal Enemy Ship Locations';
    render();
  }

  function handleEnemyClick(row, col) {
    if (state.phase !== PHASES.PLAYER_TURN) return;
    if (!B.canFireAt(state.enemyBoard, row, col)) return;

    var result = B.fireAt(state.enemyBoard, row, col);
    addLog('player', describeShot('player', row, col, result));
    setMessage(
      result.result === B.SHOT.HIT
        ? 'Hit. ' + result.shipName + '.' + (result.sunk ? ' You sank my ' + result.shipName + '!' : '')
        : 'Miss.',
      result.result === B.SHOT.HIT ? 'info' : null
    );
    renderEnemyBoard();
    renderFleetStatus();

    if (result.fleetDefeated) {
      endGame('player');
      return;
    }

    setPhase(PHASES.OPPONENT_TURN);
    setMessage('Opponent is taking their turn…', null);
    window.setTimeout(takeOpponentTurn, OPPONENT_DELAY_MS);
  }

  function takeOpponentTurn() {
    var target = B.chooseOpponentTarget(state.playerBoard);
    if (!target) {
      setPhase(PHASES.PLAYER_TURN);
      return;
    }

    var result = B.fireAt(state.playerBoard, target.row, target.col);
    addLog('opponent', describeShot('opponent', target.row, target.col, result));
    renderPlayerBoard();
    renderFleetStatus();

    if (result.fleetDefeated) {
      endGame('opponent');
      return;
    }

    setPhase(PHASES.PLAYER_TURN);
    setMessage(
      result.result === B.SHOT.HIT
        ? 'Opponent hit your ' + result.shipName + '.' +
          (result.sunk ? ' Opponent sank your ' + result.shipName + '!' : '') + ' Your turn.'
        : 'Opponent missed. Your turn.',
      result.result === B.SHOT.HIT ? 'error' : 'info'
    );
  }

  function newGame() {
    B.clearBoard(state.playerBoard);
    B.clearBoard(state.enemyBoard);
    state.selectedShipId = B.SHIP_TYPES[0].id;
    state.orientation = B.ORIENTATIONS.HORIZONTAL;
    state.hover = null;
    state.log = [];
    state.winner = null;
    state.revealEnemy = false;
    els.btnReveal.classList.add('hidden');
    setPhase(PHASES.PLACEMENT);
    setOrientation(state.orientation);
    updateStartButton();
    setMessage('New game. Place your fleet.', 'info');
    render();
  }

  /* ---------- wiring ---------- */

  function init() {
    buildGrid(els.playerBoard, playerCells);
    buildGrid(els.enemyBoard, enemyCells);
    setPhase(PHASES.PLACEMENT);
    setOrientation(state.orientation);
    updateStartButton();
    render();

    els.playerBoard.addEventListener('mouseover', function (event) {
      if (state.phase !== PHASES.PLACEMENT) return;
      var target = event.target;
      if (!target.classList.contains('cell')) return;
      state.hover = { row: Number(target.dataset.row), col: Number(target.dataset.col) };
      renderPlayerBoard();
    });

    els.playerBoard.addEventListener('mouseleave', function () {
      state.hover = null;
      renderPlayerBoard();
    });

    els.playerBoard.addEventListener('click', function (event) {
      if (state.phase !== PHASES.PLACEMENT) return;
      var target = event.target;
      if (!target.classList.contains('cell')) return;
      handlePlacementClick(Number(target.dataset.row), Number(target.dataset.col));
    });

    els.enemyBoard.addEventListener('click', function (event) {
      var target = event.target;
      if (!target.classList.contains('cell')) return;
      handleEnemyClick(Number(target.dataset.row), Number(target.dataset.col));
    });

    document.addEventListener('keydown', function (event) {
      if (state.phase !== PHASES.PLACEMENT) return;
      if (event.key === 'r' || event.key === 'R') {
        setOrientation(B.toggleOrientation(state.orientation));
      }
    });

    els.btnRandom.addEventListener('click', function () {
      if (B.placeFleetRandomly(state.playerBoard)) {
        state.selectedShipId = null;
        setMessage('Fleet placed randomly. Press Start Game.', 'info');
      } else {
        setMessage('Could not generate a random placement. Try again.', 'error');
      }
      renderFleet();
      renderPlayerBoard();
      updateStartButton();
    });

    els.btnReset.addEventListener('click', function () {
      B.clearBoard(state.playerBoard);
      state.selectedShipId = B.SHIP_TYPES[0].id;
      setMessage('Board cleared.', 'info');
      renderFleet();
      renderPlayerBoard();
      updateStartButton();
    });

    els.btnReveal.addEventListener('click', function () {
      if (state.phase !== PHASES.OVER) return;
      state.revealEnemy = !state.revealEnemy;
      els.btnReveal.textContent = state.revealEnemy
        ? 'Hide Enemy Ship Locations'
        : 'Reveal Enemy Ship Locations';
      renderEnemyBoard();
    });

    els.btnStart.addEventListener('click', startGame);
    els.btnNewGame.addEventListener('click', newGame);
  }

  init();
})();
