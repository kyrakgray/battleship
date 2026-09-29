/**
 * Voice scouting: say "scout A4" instead of clicking the square.
 *
 * Uses the browser's own speech recognition, so nothing leaves the page and
 * the game keeps its no-dependency runtime. Support is uneven (Chrome, Edge
 * and Safari have it; Firefox does not), so this is strictly an extra way in
 * — clicking a square always works.
 */
(function () {
  'use strict';

  var ROWS = 'ABCDEFGHIJ';

  /** What a microphone hears instead of a plain letter or number. */
  var WORD_ROWS = {
    alpha: 'A', ay: 'A',
    bravo: 'B', bee: 'B', be: 'B',
    charlie: 'C', see: 'C', sea: 'C',
    delta: 'D', dee: 'D',
    echo: 'E', ee: 'E',
    foxtrot: 'F', eff: 'F', ef: 'F',
    golf: 'G', gee: 'G',
    hotel: 'H', aitch: 'H',
    india: 'I', eye: 'I', aye: 'I',
    juliet: 'J', juliett: 'J', jay: 'J'
  };

  var WORD_NUMBERS = {
    one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, tree: 3, four: 4, for: 4,
    fore: 4, five: 5, six: 6, sex: 6, seven: 7, eight: 8, ate: 8, nine: 9,
    ten: 10, zero: 10
  };

  /**
   * Pull a square out of whatever was heard. Accepts "scout A4", "a four",
   * "alpha 4", "A 10" and the stray filler a microphone adds around them.
   * Returns { row, col } as zero-based indices, or null when it is not a
   * square anyone could have meant.
   */
  function parseSquare(heard) {
    if (!heard) return null;
    var words = String(heard).toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ');

    var tokens = [];
    words.forEach(function (word) {
      if (!word) return;
      // "a4" and "a 4" should read the same.
      var joined = /^([a-z])(\d{1,2})$/.exec(word);
      if (joined) {
        tokens.push(joined[1]);
        tokens.push(joined[2]);
        return;
      }
      tokens.push(word);
    });

    var row = null;
    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i];
      var letter = token.length === 1 && /[a-z]/.test(token)
        ? token.toUpperCase()
        : WORD_ROWS[token] || null;

      if (row === null) {
        if (letter && ROWS.indexOf(letter) !== -1) row = ROWS.indexOf(letter);
        continue;
      }

      var number = /^\d{1,2}$/.test(token) ? Number(token) : WORD_NUMBERS[token];
      if (number >= 1 && number <= 10) return { row: row, col: number - 1 };
      // A second letter means the first was filler ("okay, scout B7").
      if (letter && ROWS.indexOf(letter) !== -1) row = ROWS.indexOf(letter);
    }
    return null;
  }

  function Recognizer() {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return null;
    var recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;
    return recognition;
  }

  var recognition = null;
  var listening = false;
  var handlers = {};

  function report(kind, detail) {
    if (handlers[kind]) handlers[kind](detail);
  }

  var api = {
    parseSquare: parseSquare,

    isSupported: function () {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    },

    isListening: function () { return listening; },

    /**
     * handlers: { onSquare, onUnclear, onState, onError }. Starting asks the
     * browser for the microphone, which is why it only happens on a click.
     */
    start: function (next) {
      handlers = next || {};
      if (!api.isSupported()) {
        report('onError', 'unsupported');
        return false;
      }
      if (listening) return true;

      recognition = recognition || Recognizer();
      recognition.onresult = function (event) {
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var heard = event.results[i][0].transcript.trim();
          var square = parseSquare(heard);
          if (square) report('onSquare', square);
          else report('onUnclear', heard);
        }
      };
      recognition.onerror = function (event) {
        var reason = event && event.error;
        // A quiet stretch is not a failure; keep the microphone open.
        if (reason === 'no-speech' || reason === 'aborted') return;
        listening = false;
        report('onError', reason || 'failed');
        report('onState', false);
      };
      recognition.onend = function () {
        if (!listening) return;
        // Browsers close the stream on their own; reopen while listening.
        try { recognition.start(); } catch (err) { listening = false; report('onState', false); }
      };

      try {
        recognition.start();
      } catch (err) {
        report('onError', 'failed');
        return false;
      }
      listening = true;
      report('onState', true);
      return true;
    },

    stop: function () {
      listening = false;
      if (recognition) {
        try { recognition.stop(); } catch (err) { /* already closed */ }
      }
      report('onState', false);
    }
  };

  window.CaliforniaFiveVoice = api;
}());
