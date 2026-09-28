/** Rendering and event wiring. All game rules live in game.js. */
(function () {
  'use strict';

  var B = window.Battleship;

  var state = {
    board: B.createBoard(),
    selectedShipId: B.SHIP_TYPES[0].id,
    orientation: B.ORIENTATIONS.HORIZONTAL,
    hover: null
  };

  var els = {
    playerBoard: document.getElementById('player-board'),
    enemyBoard: document.getElementById('enemy-board'),
    fleetList: document.getElementById('fleet-list'),
    message: document.getElementById('message'),
    orientationLabel: document.getElementById('orientation-label'),
    btnRandom: document.getElementById('btn-random'),
    btnReset: document.getElementById('btn-reset'),
    btnStart: document.getElementById('btn-start')
  };

  var playerCells = {};

  function cellKey(row, col) {
    return row + ',' + col;
  }

  function buildGrid(container, interactive) {
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
        if (interactive) playerCells[cellKey(row, col)] = cell;
      }
    }
  }

  function renderFleet() {
    els.fleetList.innerHTML = '';
    B.SHIP_TYPES.forEach(function (type) {
      var placed = Boolean(state.board.ships[type.id]);
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

  function renderBoard() {
    for (var row = 0; row < B.BOARD_SIZE; row++) {
      for (var col = 0; col < B.BOARD_SIZE; col++) {
        var cell = playerCells[cellKey(row, col)];
        var shipId = state.board.grid[row][col];
        cell.className = 'cell' + (shipId ? ' ship' : '');
        cell.style.background = shipId ? B.getShipType(shipId).color : '';
      }
    }
    renderPreview();
  }

  function renderPreview() {
    if (!state.hover || !state.selectedShipId) return;
    if (state.board.ships[state.selectedShipId]) return;

    var type = B.getShipType(state.selectedShipId);
    var result = B.validatePlacement(
      state.board, state.selectedShipId, state.hover.row, state.hover.col, state.orientation
    );
    var cells = B.shipCells(state.hover.row, state.hover.col, type.length, state.orientation);

    cells.forEach(function (pos) {
      var cell = playerCells[cellKey(pos.row, pos.col)];
      if (!cell) return;
      cell.classList.add(result.valid ? 'preview-valid' : 'preview-invalid');
      cell.style.background = '';
    });
  }

  function setMessage(text, kind) {
    els.message.textContent = text || '';
    els.message.className = 'message' + (kind ? ' ' + kind : '');
  }

  function firstUnplacedShipId() {
    for (var i = 0; i < B.SHIP_TYPES.length; i++) {
      if (!state.board.ships[B.SHIP_TYPES[i].id]) return B.SHIP_TYPES[i].id;
    }
    return null;
  }

  function selectShip(shipId) {
    state.selectedShipId = shipId;
    if (state.board.ships[shipId]) {
      setMessage(B.getShipType(shipId).name + ' is already placed. Use Reset Placement to start over.', 'error');
    } else {
      setMessage('');
    }
    renderFleet();
    renderBoard();
  }

  function updateStartButton() {
    els.btnStart.disabled = !B.allShipsPlaced(state.board);
  }

  function handleCellClick(row, col) {
    var shipId = state.selectedShipId;
    if (!shipId || state.board.ships[shipId]) {
      var next = firstUnplacedShipId();
      if (!next) {
        setMessage('All ships are placed. Press Start Game.', 'info');
        return;
      }
      shipId = next;
      state.selectedShipId = next;
    }

    var result = B.placeShip(state.board, shipId, row, col, state.orientation);
    if (!result.success) {
      setMessage(result.reason, 'error');
      renderFleet();
      renderBoard();
      return;
    }

    setMessage(B.getShipType(shipId).name + ' placed at ' + B.coordLabel(row, col) + '.', 'info');
    var nextShip = firstUnplacedShipId();
    state.selectedShipId = nextShip;
    renderFleet();
    renderBoard();
    updateStartButton();
    if (!nextShip) setMessage('Fleet ready. Press Start Game.', 'info');
  }

  function handleHover(event) {
    var target = event.target;
    if (!target.classList.contains('cell')) return;
    state.hover = { row: Number(target.dataset.row), col: Number(target.dataset.col) };
    renderBoard();
  }

  function clearHover() {
    state.hover = null;
    renderBoard();
  }

  function setOrientation(orientation) {
    state.orientation = orientation;
    els.orientationLabel.textContent =
      orientation === B.ORIENTATIONS.HORIZONTAL ? 'Horizontal' : 'Vertical';
    renderBoard();
  }

  function init() {
    buildGrid(els.playerBoard, true);
    buildGrid(els.enemyBoard, false);
    renderFleet();
    renderBoard();
    setOrientation(state.orientation);
    updateStartButton();

    els.playerBoard.addEventListener('mouseover', handleHover);
    els.playerBoard.addEventListener('mouseleave', clearHover);
    els.playerBoard.addEventListener('click', function (event) {
      var target = event.target;
      if (!target.classList.contains('cell')) return;
      handleCellClick(Number(target.dataset.row), Number(target.dataset.col));
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'r' || event.key === 'R') {
        setOrientation(B.toggleOrientation(state.orientation));
      }
    });

    els.btnRandom.addEventListener('click', function () {
      if (B.placeFleetRandomly(state.board)) {
        state.selectedShipId = null;
        setMessage('Fleet placed randomly. Press Start Game.', 'info');
      } else {
        setMessage('Could not generate a random placement. Try again.', 'error');
      }
      renderFleet();
      renderBoard();
      updateStartButton();
    });

    els.btnReset.addEventListener('click', function () {
      B.clearBoard(state.board);
      state.selectedShipId = B.SHIP_TYPES[0].id;
      setMessage('Board cleared.', 'info');
      renderFleet();
      renderBoard();
      updateStartButton();
    });

    els.btnStart.addEventListener('click', function () {
      console.log('Start Game — fleet:', JSON.parse(JSON.stringify(state.board.ships)));
      setMessage('Start Game logged to console. The game loop comes in a later session.', 'info');
    });
  }

  init();
})();
