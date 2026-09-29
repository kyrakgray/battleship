/** Rendering and event wiring. All game rules live in game.js. */
(function () {
  'use strict';

  var B = window.CaliforniaFive;

  var PHASES = { PLACEMENT: 'placement', PLAYER_TURN: 'player-turn', RIVAL_TURN: 'rival-turn', OVER: 'over' };
  var RIVAL_DELAY_MS = 600;
  var LOG_PIN_SLACK_PX = 24;
  /** How long the result is called over the maps before the season card. */
  var RESULT_DELAY_MS = 2600;
  var flashTimer = null;

  var state = {
    phase: PHASES.PLACEMENT,
    playerBoard: B.createBoard(),
    rivalBoard: B.createBoard(),
    selectedParkId: B.PARKS[0].id,
    orientation: B.ORIENTATIONS.HORIZONTAL,
    hover: null,
    log: [],
    winner: null,
    revealRival: false,
    acresFormat: new Intl.NumberFormat('en-US')
  };

  var els = {
    phaseLabel: document.getElementById('phase-label'),
    playerBoard: document.getElementById('player-board'),
    rivalBoard: document.getElementById('rival-board'),
    parkList: document.getElementById('park-list'),
    message: document.getElementById('message'),
    orientationLabel: document.getElementById('orientation-label'),
    placementControls: document.getElementById('placement-controls'),
    seasonControls: document.getElementById('season-controls'),
    btnRandom: document.getElementById('btn-random'),
    btnReset: document.getElementById('btn-reset'),
    btnStart: document.getElementById('btn-start'),
    btnNewGame: document.getElementById('btn-new-game'),
    btnReveal: document.getElementById('btn-reveal'),
    statusPlayer: document.getElementById('status-player'),
    statusRival: document.getElementById('status-rival'),
    statusBar: document.getElementById('status-bar'),
    howTo: document.getElementById('how-to'),
    btnHowToOpen: document.getElementById('btn-how-to-open'),
    btnHowToClose: document.getElementById('btn-how-to-close'),
    btnHowToBack: document.getElementById('btn-how-to-back'),
    intro: document.getElementById('intro'),
    seal: document.getElementById('seal'),
    btnSealGo: document.getElementById('btn-seal-go'),
    btnSealBack: document.getElementById('btn-seal-back'),
    gameOver: document.getElementById('game-over'),
    gameOverKicker: document.getElementById('game-over-kicker'),
    gameOverTitle: document.getElementById('game-over-title'),
    gameOverVerdict: document.getElementById('game-over-verdict'),
    gameOverSub: document.getElementById('game-over-sub'),
    winnerFlash: document.getElementById('winner-flash'),
    gameOverStats: document.getElementById('game-over-stats'),
    btnOverClose: document.getElementById('btn-over-close'),
    btnOverNew: document.getElementById('btn-over-new'),
    playerBoardTitle: document.getElementById('player-board-title'),
    playerBoardNote: document.getElementById('player-board-note'),
    btnIntroOpen: document.getElementById('btn-intro-open'),
    btnIntroHowTo: document.getElementById('btn-intro-how-to'),
    daysUsed: document.getElementById('days-used'),
    daysTotal: document.getElementById('days-total'),
    daysLeft: document.getElementById('days-left'),
    clockFill: document.getElementById('clock-fill'),
    rivalDaysUsed: document.getElementById('rival-days-used'),
    daysUsedNote: document.getElementById('days-used-note'),
    calendarMonth: document.getElementById('calendar-month'),
    calendarDay: document.getElementById('calendar-day'),
    calendarWeekday: document.getElementById('calendar-weekday'),
    calendarNote: document.getElementById('calendar-note'),
    closingDate: document.getElementById('closing-date'),
    log: document.getElementById('log')
  };

  var playerCells = {};
  var rivalCells = {};

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

  /**
   * Markers are signed by the park they belong to; a dead end gets the
   * forest-road switchback. Icons come from the sprite in index.html.
   */
  function paintIcon(cell, day, parkId, revealed) {
    var symbol = day === B.DAY.DEAD_END ? 'icon-dead-end'
      : (day === B.DAY.TRAIL_MARKER || revealed) && parkId ? 'icon-' + parkId
      : null;
    if (cell.dataset.icon === (symbol || '')) return;
    cell.dataset.icon = symbol || '';
    cell.innerHTML = symbol
      ? '<svg class="cell-icon" aria-hidden="true"><use href="#' + symbol + '"></use></svg>'
      : '';
  }

  function acreage(park) {
    return state.acresFormat.format(park.acres) + ' acres';
  }

  function renderParkCards() {
    els.parkList.innerHTML = '';
    B.PARKS.forEach(function (type) {
      var placed = Boolean(state.playerBoard.parks[type.id]);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.style.setProperty('--park-color', type.color);
      btn.className = 'park-btn' +
        (state.selectedParkId === type.id ? ' selected' : '') +
        (placed ? ' placed' : '');
      btn.dataset.parkId = type.id;

      var label = document.createElement('span');
      label.className = 'park-label';
      label.textContent = type.name + ' (' + type.length + ')';
      btn.appendChild(label);

      var acres = document.createElement('span');
      acres.className = 'acres';
      acres.textContent = acreage(type);
      btn.appendChild(acres);

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
        selectPark(type.id);
      });
      els.parkList.appendChild(btn);
    });
  }

  /** Your own route, plus the scouting days your rival has spent on it. */
  function renderPlayerBoard() {
    for (var row = 0; row < B.BOARD_SIZE; row++) {
      for (var col = 0; col < B.BOARD_SIZE; col++) {
        var cell = playerCells[cellKey(row, col)];
        var parkId = state.playerBoard.grid[row][col];
        var day = state.playerBoard.days[row][col];
        cell.className = 'cell' + (parkId ? ' park' : '') +
          (day ? ' ' + day : '');
        cell.style.background = parkId && day !== B.DAY.DEAD_END
          ? B.getPark(parkId).color : '';
        paintIcon(cell, day, parkId);
      }
    }
    renderPreview();
  }

  /**
   * The route drawn for you: scouting results only, so the hidden parks never
   * reach the DOM — except once the season is over and the player asks to see
   * the route they missed.
   */
  function renderRivalBoard() {
    for (var row = 0; row < B.BOARD_SIZE; row++) {
      for (var col = 0; col < B.BOARD_SIZE; col++) {
        var cell = rivalCells[cellKey(row, col)];
        var day = state.rivalBoard.days[row][col];
        var parkId = state.revealRival ? state.rivalBoard.grid[row][col] : null;
        var foundParkId = day === B.DAY.TRAIL_MARKER
          ? state.rivalBoard.grid[row][col] : null;
        var reveal = Boolean(parkId) && day !== B.DAY.TRAIL_MARKER;
        cell.className = 'cell' + (day ? ' ' + day : '') + (reveal ? ' revealed' : '');
        cell.style.background = reveal ? B.getPark(parkId).color
          : foundParkId ? B.getPark(foundParkId).color : '';
        paintIcon(cell, day, state.rivalBoard.grid[row][col], reveal);
      }
    }
    els.rivalBoard.classList.toggle('disabled', state.phase !== PHASES.PLAYER_TURN);
    els.rivalBoard.setAttribute('aria-disabled', String(state.phase !== PHASES.PLAYER_TURN));
  }

  function renderPreview() {
    if (state.phase !== PHASES.PLACEMENT) return;
    if (!state.hover || !state.selectedParkId) return;
    if (state.playerBoard.parks[state.selectedParkId]) return;

    var type = B.getPark(state.selectedParkId);
    var result = B.validatePlacement(
      state.playerBoard, state.selectedParkId, state.hover.row, state.hover.col, state.orientation
    );
    var cells = B.parkCells(state.hover.row, state.hover.col, type.length, state.orientation);

    cells.forEach(function (pos) {
      var cell = playerCells[cellKey(pos.row, pos.col)];
      if (!cell) return;
      cell.classList.add(result.valid ? 'preview-valid' : 'preview-invalid');
      cell.style.background = '';
    });
  }

  /**
   * Passports: one page slot per park, inked with a dated stamp in the park's
   * own colour once every square of that park has been found. The passport
   * under a map belongs to whoever is scouting that map — your rival scouts
   * the route you drew, so their stamps sit under your map.
   */
  function renderPassports() {
    [
      { list: els.statusPlayer, board: state.playerBoard },
      { list: els.statusRival, board: state.rivalBoard }
    ].forEach(function (side) {
      side.list.innerHTML = '';
      B.PARKS.forEach(function (type) {
        var placed = side.board.parks[type.id];
        var stamped = B.isParkStamped(side.board, type.id);
        var item = document.createElement('li');
        item.className = 'stamp-slot' + (stamped ? ' stamped' : '');
        item.style.setProperty('--park-color', type.color);

        var name = document.createElement('span');
        name.className = 'stamp-name';
        name.textContent = type.name;
        item.appendChild(name);

        var detail = document.createElement('span');
        detail.className = 'stamp-detail';
        detail.textContent = type.length + ' cells · ' + acreage(type);
        item.appendChild(detail);

        if (stamped) item.appendChild(passportStamp(type, placed.stampedOnDay));

        side.list.appendChild(item);
      });
    });
  }

  /**
   * A passport stamp the way the rangers ink them: a bordered rubber mark
   * carrying the park, the state, and the date the explorer finished it.
   */
  function passportStamp(type, dayNumber) {
    var mark = document.createElement('span');
    mark.className = 'stamp-mark';
    mark.style.setProperty('--tilt', (type.name.length % 5) - 2.5 + 'deg');

    var top = document.createElement('span');
    top.className = 'stamp-mark-top';
    top.textContent = 'National Park Service';
    mark.appendChild(top);

    var park = document.createElement('span');
    park.className = 'stamp-mark-park';
    park.textContent = type.name;
    mark.appendChild(park);

    var date = document.createElement('span');
    date.className = 'stamp-mark-date';
    date.textContent = B.stampDateLabel(dayNumber || 1);
    mark.appendChild(date);

    var place = document.createElement('span');
    place.className = 'stamp-mark-place';
    place.textContent = 'California';
    mark.appendChild(place);

    return mark;
  }

  /** Trail days the player has spent, one per square scouted. */
  function playerDaysSpent() {
    return B.daysSpent(state.rivalBoard);
  }

  /** Trail days the rival has spent on the route the player drew. */
  function rivalDaysSpent() {
    return B.daysSpent(state.playerBoard);
  }

  /**
   * Both explorers scout the same date, so the calendar only turns over once
   * each of them has taken their day: today is one past the last date they
   * have both finished.
   */
  function currentSeasonDay() {
    var settled = Math.min(playerDaysSpent(), rivalDaysSpent());
    return Math.min(B.SEASON_DAYS, settled + 1);
  }

  /**
   * The season calendar: Tioga Pass is open for `SEASON_DAYS` trail days from
   * the fourth of July, and every square scouted costs one.
   */
  function renderSeasonClock() {
    var used = playerDaysSpent();
    var today = B.seasonDateParts(currentSeasonDay());
    els.calendarMonth.textContent = today.month;
    els.calendarDay.textContent = String(today.day);
    els.calendarWeekday.textContent = today.weekday;
    els.daysUsed.textContent = String(used);
    els.daysUsedNote.textContent = String(used);
    els.daysTotal.textContent = String(B.SEASON_DAYS);
    els.daysLeft.textContent = String(B.daysLeft(state.rivalBoard));
    els.closingDate.textContent = B.stampDateLabel(B.SEASON_DAYS);
    els.rivalDaysUsed.textContent = String(rivalDaysSpent());
    els.clockFill.style.width = (used / B.SEASON_DAYS * 100) + '%';
  }

  function appendLogEntry(entry) {
    var item = document.createElement('li');
    item.className = 'log-entry ' + entry.side;
    if (entry.date) {
      var date = document.createElement('span');
      date.className = 'log-date';
      date.textContent = entry.date;
      item.appendChild(date);
    }
    var text = document.createElement('span');
    text.className = 'log-text';
    text.textContent = entry.text;
    item.appendChild(text);
    els.log.appendChild(item);
    els.log.classList.remove('empty');
  }

  function scrollLogToEnd() {
    els.log.scrollTop = els.log.scrollHeight;
  }

  /** True while the player is reading the newest entries rather than scrollback. */
  function logIsPinnedToEnd() {
    return els.log.scrollHeight - els.log.scrollTop - els.log.clientHeight <=
      LOG_PIN_SLACK_PX;
  }

  function renderLog() {
    els.log.innerHTML = '';
    state.log.forEach(appendLogEntry);
    els.log.classList.toggle('empty', state.log.length === 0);
    scrollLogToEnd();
  }

  function addLog(side, text, dayNumber) {
    var pinned = logIsPinnedToEnd();
    var entry = {
      side: side,
      text: text,
      date: dayNumber ? B.stampDateLabel(dayNumber).slice(0, 6) : ''
    };
    state.log.push(entry);
    appendLogEntry(entry);
    if (pinned) scrollLogToEnd();
  }

  function setMessage(text, kind) {
    els.message.textContent = text || '';
    els.message.className = 'message' + (kind ? ' ' + kind : '');
  }

  /**
   * Route planning is its own view: one map to draw on, and no log, calendar
   * or rival map until the itineraries have been traded.
   */
  function setPhase(phase) {
    state.phase = phase;
    var placing = phase === PHASES.PLACEMENT;
    els.playerBoard.classList.toggle('disabled', !placing);
    els.placementControls.classList.toggle('hidden', !placing);
    els.seasonControls.classList.toggle('hidden', placing);
    document.body.classList.toggle('planning', placing);
    document.body.classList.toggle('season', !placing);
    els.playerBoardTitle.textContent = placing
      ? 'Your Route Map' : 'The Route You Drew';
    els.playerBoardNote.textContent = placing
      ? 'Lay out the five parks you will hand to your rival.'
      : "Sealed and handed to your rival — they're scouting it.";
    els.phaseLabel.textContent =
      placing ? 'Route planning — draw your five parks'
        : phase === PHASES.OVER
          ? (state.winner === 'player'
            ? 'Season over — you collected the California Five'
            : 'Season over — your rival finished first')
          : phase === PHASES.PLAYER_TURN
            ? 'Your scouting day — pick a square'
            : 'Your rival is out scouting…';
    els.statusBar.className = 'status' +
      (phase === PHASES.PLAYER_TURN ? ' your-turn'
        : phase === PHASES.RIVAL_TURN ? ' waiting'
          : phase === PHASES.OVER ? ' over' : '');
    renderRivalBoard();
  }

  function render() {
    renderParkCards();
    renderPlayerBoard();
    renderRivalBoard();
    renderPassports();
    renderSeasonClock();
    renderLog();
  }

  /* ---------- placement phase ---------- */

  function firstUnplacedParkId() {
    for (var i = 0; i < B.PARKS.length; i++) {
      if (!state.playerBoard.parks[B.PARKS[i].id]) return B.PARKS[i].id;
    }
    return null;
  }

  function selectPark(parkId) {
    state.selectedParkId = parkId;
    if (state.playerBoard.parks[parkId]) {
      setMessage(B.getPark(parkId).name + ' is already on your route. Use Clear Route to start over.', 'error');
    } else {
      setMessage('');
    }
    renderParkCards();
    renderPlayerBoard();
  }

  function updateStartButton() {
    els.btnStart.disabled = !B.allParksPlaced(state.playerBoard);
  }

  function handlePlacementClick(row, col) {
    var parkId = state.selectedParkId;
    if (!parkId || state.playerBoard.parks[parkId]) {
      var next = firstUnplacedParkId();
      if (!next) {
        setMessage('All five parks are on your route. Seal and trade.', 'info');
        return;
      }
      parkId = next;
      state.selectedParkId = next;
    }

    var result = B.placePark(state.playerBoard, parkId, row, col, state.orientation);
    if (!result.success) {
      setMessage(result.reason, 'error');
      renderParkCards();
      renderPlayerBoard();
      return;
    }

    setMessage(B.getPark(parkId).name + ' penciled in at ' + B.coordLabel(row, col) + '.', 'info');
    state.selectedParkId = firstUnplacedParkId();
    renderParkCards();
    renderPlayerBoard();
    updateStartButton();
    if (!state.selectedParkId) setMessage('Route complete. Seal and trade.', 'info');
  }

  function setOrientation(orientation) {
    state.orientation = orientation;
    els.orientationLabel.textContent =
      orientation === B.ORIENTATIONS.HORIZONTAL ? 'Across' : 'Down';
    renderPlayerBoard();
  }

  /* ---------- season phase ---------- */

  /** Themed field-note copy for one scouting day. */
  function describeDay(scout, row, col, result) {
    var who = scout === 'player' ? 'You scouted ' : 'Your rival scouted ';
    var where = B.coordLabel(row, col);
    if (result.result === B.DAY.DEAD_END) {
      return who + where + '. Dead end — a day burned on a forest road.';
    }
    var note = who + where + '. Trail marker — ' +
      (scout === 'player' ? "you're" : "they're") + ' on the route. ' +
      result.parkName + '.';
    if (result.stamped) {
      note += scout === 'player'
        ? ' ' + result.parkName + ' stamped in your passport!'
        : ' They stamped ' + result.parkName + '!';
    }
    return note;
  }

  /** The finished itinerary goes into the envelope before it is traded. */
  function openSeal() {
    if (!B.allParksPlaced(state.playerBoard)) return;
    els.seal.classList.remove('hidden');
  }

  function startGame() {
    if (!B.allParksPlaced(state.playerBoard)) return;
    els.seal.classList.add('hidden');
    B.clearBoard(state.rivalBoard);
    B.placeRouteRandomly(state.rivalBoard);
    state.hover = null;
    state.winner = null;
    state.revealRival = false;
    state.log = [];
    els.howTo.classList.add('hidden');
    els.intro.classList.add('hidden');
    els.btnReveal.classList.add('hidden');
    addLog('system', 'Routes sealed and traded. Tioga Pass is open for ' +
      B.SEASON_DAYS + ' trail days. You take the first scouting day.', 1);
    setPhase(PHASES.PLAYER_TURN);
    setMessage('Your scouting day. Pick a square on the route drawn for you.', 'info');
    render();
  }

  /** Total squares an itinerary covers — the five parks laid end to end. */
  var ROUTE_SQUARES = B.PARKS.reduce(function (sum, park) {
    return sum + park.length;
  }, 0);

  /** One explorer's season in numbers, read off the map they scouted. */
  function seasonCard(board) {
    var markers = 0;
    var deadEnds = 0;
    for (var row = 0; row < B.BOARD_SIZE; row++) {
      for (var col = 0; col < B.BOARD_SIZE; col++) {
        var day = board.days[row][col];
        if (day === B.DAY.TRAIL_MARKER) markers++;
        else if (day === B.DAY.DEAD_END) deadEnds++;
      }
    }
    var days = markers + deadEnds;
    return {
      days: days,
      markers: markers,
      deadEnds: deadEnds,
      stamps: B.stampedParkIds(board).length,
      accuracy: days ? Math.round(markers / days * 100) : 0,
      daysLeft: B.SEASON_DAYS - days
    };
  }

  function statRow(label, playerValue, rivalValue) {
    var row = document.createElement('tr');
    var head = document.createElement('th');
    head.scope = 'row';
    head.textContent = label;
    row.appendChild(head);
    [playerValue, rivalValue].forEach(function (value) {
      var cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    return row;
  }

  /** The result window: who took the Classic, and both season cards. */
  function renderGameOver(winner) {
    var you = seasonCard(state.rivalBoard);
    var rival = seasonCard(state.playerBoard);
    var wonByPlayer = winner === 'player';

    els.gameOver.classList.toggle('lost', !wonByPlayer);
    els.gameOverKicker.textContent = wonByPlayer
      ? 'Summer Classic · ' + B.stampDateLabel(you.days)
      : 'Summer Classic · ' + B.stampDateLabel(rival.days);
    els.gameOverTitle.textContent = wonByPlayer
      ? 'You collected the California Five'
      : 'Your rival collected the California Five';
    els.gameOverVerdict.textContent = wonByPlayer ? 'You won!' : 'You lost';
    els.gameOverSub.textContent = wonByPlayer
      ? 'All five parks stamped in ' + you.days + ' trail days, with ' +
        you.daysLeft + ' left before Tioga Pass closes.'
      : 'Your rival finished the itinerary you drew in ' + rival.days +
        ' trail days. You were ' + (ROUTE_SQUARES - you.markers) +
        ' squares short.';

    els.gameOverStats.innerHTML = '';
    [
      statRow('Trail days spent', you.days, rival.days),
      statRow('Squares found', you.markers + ' of ' + ROUTE_SQUARES,
        rival.markers + ' of ' + ROUTE_SQUARES),
      statRow('Dead ends', you.deadEnds, rival.deadEnds),
      statRow('Scouting accuracy', you.accuracy + '%', rival.accuracy + '%'),
      statRow('Passport stamps', you.stamps + ' of 5', rival.stamps + ' of 5')
    ].forEach(function (row) {
      els.gameOverStats.appendChild(row);
    });

    els.gameOver.classList.remove('hidden');
  }

  /** The result called over the maps, held there before the season card. */
  function flashWinner(winner) {
    var wonByPlayer = winner === 'player';
    els.winnerFlash.textContent = wonByPlayer ? 'You won!' : 'Your rival won';
    els.winnerFlash.classList.toggle('lost', !wonByPlayer);
    els.winnerFlash.classList.remove('hidden');
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(function () {
      els.winnerFlash.classList.add('hidden');
      renderGameOver(winner);
    }, RESULT_DELAY_MS);
  }

  function endGame(winner) {
    state.winner = winner;
    setPhase(PHASES.OVER);
    var days = B.daysSpent(winner === 'player' ? state.rivalBoard : state.playerBoard);
    var text = winner === 'player'
      ? 'The California Five! All five parks stamped in ' + days + ' trail days.'
      : 'Your rival finished their itinerary first, in ' + days + ' trail days.';
    addLog('system', text, days);
    setMessage(text, winner === 'player' ? 'info' : 'error');
    els.btnReveal.classList.toggle('hidden', winner === 'player');
    els.btnReveal.textContent = 'Reveal the Route You Missed';
    render();
    flashWinner(winner);
  }

  function handleRivalClick(row, col) {
    if (state.phase !== PHASES.PLAYER_TURN) return;
    if (!B.canScout(state.rivalBoard, row, col)) return;

    var result = B.scout(state.rivalBoard, row, col);
    addLog('player', describeDay('player', row, col, result), playerDaysSpent());
    setMessage(
      result.result === B.DAY.TRAIL_MARKER
        ? "Trail marker. You're on the route — " + result.parkName + '.' +
          (result.stamped ? ' ' + result.parkName + ' stamped!' : '')
        : 'Dead end. You burned a day on a forest road.',
      result.result === B.DAY.TRAIL_MARKER ? 'info' : null
    );
    renderRivalBoard();
    renderPassports();
    renderSeasonClock();

    if (result.routeComplete) {
      endGame('player');
      return;
    }

    setPhase(PHASES.RIVAL_TURN);
    setMessage('Your rival is out scouting…', null);
    window.setTimeout(takeRivalTurn, RIVAL_DELAY_MS);
  }

  function takeRivalTurn() {
    var target = B.chooseRivalSquare(state.playerBoard);
    if (!target) {
      setPhase(PHASES.PLAYER_TURN);
      return;
    }

    var result = B.scout(state.playerBoard, target.row, target.col);
    addLog('rival', describeDay('rival', target.row, target.col, result),
      rivalDaysSpent());
    renderPlayerBoard();
    renderPassports();
    renderSeasonClock();

    if (result.routeComplete) {
      endGame('rival');
      return;
    }

    setPhase(PHASES.PLAYER_TURN);
    setMessage(
      result.result === B.DAY.TRAIL_MARKER
        ? 'Your rival found ' + result.parkName + ' on your route.' +
          (result.stamped ? ' They stamped ' + result.parkName + '!' : '') +
          ' Your scouting day.'
        : 'Your rival reached a dead end. Your scouting day.',
      result.result === B.DAY.TRAIL_MARKER ? 'error' : 'info'
    );
  }

  function newGame() {
    B.clearBoard(state.playerBoard);
    B.clearBoard(state.rivalBoard);
    state.selectedParkId = B.PARKS[0].id;
    state.orientation = B.ORIENTATIONS.HORIZONTAL;
    state.hover = null;
    state.log = [];
    state.winner = null;
    state.revealRival = false;
    window.clearTimeout(flashTimer);
    els.winnerFlash.classList.add('hidden');
    els.btnReveal.classList.add('hidden');
    els.gameOver.classList.add('hidden');
    els.seal.classList.add('hidden');
    setPhase(PHASES.PLACEMENT);
    setOrientation(state.orientation);
    updateStartButton();
    setMessage('New season. Draw your route.', 'info');
    render();
  }

  /* ---------- wiring ---------- */

  function openHowTo() {
    els.intro.classList.add('hidden');
    els.howTo.classList.remove('hidden');
  }

  function openStory() {
    els.howTo.classList.add('hidden');
    els.intro.classList.remove('hidden');
  }

  function init() {
    buildGrid(els.playerBoard, playerCells);
    buildGrid(els.rivalBoard, rivalCells);
    setPhase(PHASES.PLACEMENT);
    setOrientation(state.orientation);
    updateStartButton();
    setMessage('Lay all five parks on your route to begin.', 'info');
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

    els.rivalBoard.addEventListener('click', function (event) {
      var target = event.target;
      if (!target.classList.contains('cell')) return;
      handleRivalClick(Number(target.dataset.row), Number(target.dataset.col));
    });

    document.addEventListener('keydown', function (event) {
      if (state.phase !== PHASES.PLACEMENT) return;
      if (event.key === 'r' || event.key === 'R') {
        setOrientation(B.toggleOrientation(state.orientation));
      }
    });

    els.btnRandom.addEventListener('click', function () {
      if (B.placeRouteRandomly(state.playerBoard)) {
        state.selectedParkId = null;
        setMessage('Random route drawn. Seal and trade.', 'info');
      } else {
        setMessage('Could not draw a random route. Try again.', 'error');
      }
      renderParkCards();
      renderPlayerBoard();
      updateStartButton();
    });

    els.btnReset.addEventListener('click', function () {
      B.clearBoard(state.playerBoard);
      state.selectedParkId = B.PARKS[0].id;
      setMessage('Route cleared.', 'info');
      renderParkCards();
      renderPlayerBoard();
      updateStartButton();
    });

    els.btnReveal.addEventListener('click', function () {
      if (state.phase !== PHASES.OVER) return;
      state.revealRival = !state.revealRival;
      els.btnReveal.textContent = state.revealRival
        ? 'Hide the Route You Missed'
        : 'Reveal the Route You Missed';
      renderRivalBoard();
    });

    // The story window leads into how to play, and that window is the one
    // that drops you into the Classic. Both stay reachable mid-season.
    els.btnHowToClose.addEventListener('click', function () {
      els.howTo.classList.add('hidden');
    });

    els.btnHowToBack.addEventListener('click', openStory);

    els.btnHowToOpen.addEventListener('click', openHowTo);

    els.btnIntroHowTo.addEventListener('click', openHowTo);

    els.btnIntroOpen.addEventListener('click', openStory);

    els.btnStart.addEventListener('click', openSeal);
    els.btnSealGo.addEventListener('click', startGame);
    els.btnSealBack.addEventListener('click', function () {
      els.seal.classList.add('hidden');
    });
    els.btnOverClose.addEventListener('click', function () {
      els.gameOver.classList.add('hidden');
    });
    els.btnOverNew.addEventListener('click', newGame);
    els.btnNewGame.addEventListener('click', newGame);
  }

  init();
})();
