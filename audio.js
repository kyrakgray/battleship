/**
 * Trail sound: synthesized effects and the ranger's recorded lines.
 *
 * Effects are generated with the Web Audio API, apart from the pencil,
 * which is a recording. Voice lines are pre-rendered mp3s under voice/;
 * if one is missing the browser's own speech synthesis reads the line
 * instead, so the game is never silent where it promised a voice.
 *
 * The result the ranger reads out carries the day count, which is only
 * known once the season ends, so it is spoken in three clips: the line up
 * to the number, the number itself, and the rest.
 */
(function () {
  'use strict';

  var STORE_KEY = 'california-five-sound';
  var VOICE_DIR = 'voice/';

  /** Every line the ranger speaks, keyed by the moment it belongs to. */
  var LINES = {
    welcome: 'Welcome to The California National Park Summer Classic.',
    briefing: "Before you draw your route, here is a ranger's briefing on how to play.",
    planning: 'Before the race can begin, draw your route for your rival to scout ' +
      'over the course of this summer.',
    sealed: 'Signed, sealed, and delivered.',
    'game-on': 'Game on! May the best explorer win. Find your route before the ' +
      'El Nino winter arrives.',
    'last-park-you': 'You have only one park left to find! Keep scouting to beat ' +
      'your rival and win the race!',
    'last-park-rival': 'Your rival has one more park left to find. Now you must ' +
      'choose carefully to win the race.',
    'result-win': 'Well, look at that. You stamped all five of the California ' +
      'Five in',
    'result-win-end': "days... beat your rival fair and square. Take a minute " +
      "to review your winning race, or head out on a new season and make 'em " +
      'suffer again.',
    'result-loss': 'Your rival got there first. All five parks in',
    'result-loss-end': 'days, while you were still squinting at a map. Go on ' +
      'and review the race to see where you went wrong, or start a new season ' +
      'and get even.'
  };
  // Every day count a season can end on: seventeen squares is the fewest that
  // can hold all five parks, and the season closes at a hundred.
  for (var day = 17; day <= 100; day++) LINES['count-' + day] = String(day);
  ['death-valley', 'joshua-tree', 'yosemite', 'kings-canyon', 'sequoia']
    .forEach(function (id) {
      var name = id.split('-').map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }).join(' ');
      LINES['found-you-' + id] = 'You found ' + name + '.';
      LINES['found-rival-' + id] = 'Your rival found ' + name + '.';
    });

  /** A park's trail marker rings its own note. */
  var PARK_TONES = {
    'death-valley': 196.0,
    'joshua-tree': 261.63,
    'yosemite': 329.63,
    'kings-canyon': 392.0,
    'sequoia': 523.25
  };

  var prefs = { effects: true, voice: true };
  try {
    var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
    if (saved) {
      prefs.effects = saved.effects !== false;
      prefs.voice = saved.voice !== false;
    }
  } catch (err) { /* private browsing: keep the defaults */ }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
    } catch (err) { /* nothing to do */ }
  }

  var ctx = null;
  function audioContext() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    return ctx;
  }

  /** One shaped tone: the building block of every effect below. */
  function tone(opts) {
    var ac = audioContext();
    if (!ac) return;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    var at = ac.currentTime + (opts.delay || 0);
    var length = opts.length || 0.18;
    var peak = opts.peak || 0.12;

    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.from, at);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, at + length);

    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

    osc.connect(gain).connect(ac.destination);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }

  /** Filtered noise: pencil on paper, and the body of the stamp. */
  function noise(opts) {
    var ac = audioContext();
    if (!ac) return;
    var length = opts.length || 0.2;
    var frames = Math.floor(ac.sampleRate * length);
    var buffer = ac.createBuffer(1, frames, ac.sampleRate);
    var data = buffer.getChannelData(0);
    var envelope = opts.envelope;
    for (var i = 0; i < frames; i++) {
      var at01 = i / frames;
      data[i] = (Math.random() * 2 - 1) * (envelope ? envelope(at01) : 1 - at01);
    }

    var src = ac.createBufferSource();
    src.buffer = buffer;
    var filter = ac.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.value = opts.frequency || 1800;
    filter.Q.value = opts.q || 1;
    var gain = ac.createGain();
    var at = ac.currentTime + (opts.delay || 0);
    gain.gain.setValueAtTime(opts.peak || 0.09, at);
    // A shaped buffer carries its own decay; otherwise fade it out here.
    gain.gain.exponentialRampToValueAtTime(0.0001, at + (envelope ? length + 0.01 : length));

    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(at);
  }

  /** Graphite dragging over paper: a rise, a gritty middle, a lift. */
  function graphite(at01) {
    var swell = Math.pow(Math.sin(Math.PI * at01), 0.7);
    var grain = 0.55 + 0.45 * Math.sin(at01 * 190);
    return swell * grain;
  }

  /** A struck wooden bar: hard transient, then a short marimba-like body. */
  function knock(opts) {
    var peak = opts.peak || 0.1;
    var length = opts.length || 0.2;
    noise({
      delay: opts.delay, length: 0.024, frequency: opts.from * 3, q: 0.6,
      peak: peak * 0.45
    });
    tone({
      delay: opts.delay, from: opts.from, to: opts.to, length: length,
      type: 'sine', peak: peak
    });
    tone({
      delay: opts.delay, from: opts.from * 4, length: length * 0.35,
      type: 'sine', peak: peak * 0.3
    });
  }

  var pencil = null;

  var EFFECTS = {
    /** A pencil laying a park down on the paper map: a recorded stroke. */
    draw: function () {
      if (!pencil) {
        pencil = new window.Audio('sfx/pencil.mp3?v=29');
        pencil.preload = 'auto';
      }
      pencil.currentTime = 0;
      var playback = pencil.play();
      if (playback && playback.catch) playback.catch(EFFECTS.drawSynth);
    },
    /** Graphite on paper, drawn by hand where the recording cannot play. */
    drawSynth: function () {
      [
        { delay: 0.00, length: 0.13, frequency: 1500 },
        { delay: 0.12, length: 0.09, frequency: 1150 },
        { delay: 0.21, length: 0.15, frequency: 1750 },
        { delay: 0.35, length: 0.08, frequency: 1300 }
      ].forEach(function (stroke) {
        noise({
          delay: stroke.delay, length: stroke.length, frequency: stroke.frequency,
          q: 0.5, peak: 0.42, envelope: graphite
        });
        // A soft-leaded pencil is felt as much as heard: the body of each
        // stroke sits well below the grain.
        noise({
          delay: stroke.delay, length: stroke.length, frequency: 260,
          filter: 'lowpass', peak: 0.34, envelope: graphite
        });
      });
    },
    /** A day lost on a forest road: a hollow knock on deadfall. */
    deadEnd: function () {
      knock({ from: 165, to: 120, length: 0.2, peak: 0.11 });
      knock({ from: 104, to: 82, length: 0.3, peak: 0.09, delay: 0.13 });
      noise({ length: 0.26, frequency: 260, filter: 'lowpass', peak: 0.05, delay: 0.13 });
    },
    /** A trail marker, struck on the park's own wooden note. */
    marker: function (parkId) {
      var base = PARK_TONES[parkId] || 330;
      knock({ from: base, length: 0.24, peak: 0.1 });
      knock({ from: base * 1.5, length: 0.34, peak: 0.075, delay: 0.1 });
    },
    /** The rubber stamp: ink pad, the press, and the lift off the page. */
    stamp: function () {
      noise({ length: 0.05, frequency: 1500, filter: 'lowpass', peak: 0.2 });
      noise({ length: 0.07, frequency: 3400, q: 0.7, peak: 0.07 });
      tone({ from: 110, to: 62, length: 0.1, type: 'sine', peak: 0.18 });
      noise({ length: 0.05, frequency: 2600, q: 1.2, peak: 0.05, delay: 0.12 });
    }
  };

  var clips = {};
  var readOuts = {};
  var readOutRun = 0;
  var voiceNow = null;
  var queued = null;

  /**
   * Stitches the parts of a read-out into one clip. Playing them one after
   * another leaves a seam where the next recording is still loading, so the
   * parts are fetched up front and joined into a single stream.
   */
  function joinClips(keys) {
    var id = keys.join('|');
    if (!readOuts[id]) {
      if (!window.fetch || !window.Blob || !window.URL) return null;
      readOuts[id] = window.Promise.all(keys.map(function (key) {
        return window.fetch(VOICE_DIR + key + '.mp3').then(function (response) {
          if (!response.ok) throw new Error(key);
          return response.blob();
        });
      })).then(function (parts) {
        return window.URL.createObjectURL(
          new window.Blob(parts, { type: 'audio/mpeg' }));
      });
      readOuts[id]['catch'](function () { delete readOuts[id]; });
    }
    return readOuts[id];
  }

  function clipFor(key) {
    if (!clips[key]) {
      var audio = new window.Audio(VOICE_DIR + key + '.mp3');
      audio.preload = 'auto';
      clips[key] = audio;
    }
    return clips[key];
  }

  /** Last resort when a clip is missing: the browser's own ranger. */
  function speak(keys) {
    var synth = window.speechSynthesis;
    var text = keys.map(function (key) { return LINES[key] || ''; }).join(' ');
    if (!synth || !text.trim()) return;
    var utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 0.7;
    synth.cancel();
    synth.speak(utterance);
  }

  /** Plays clips back to back; one missing recording spoils the whole run. */
  function playClips(keys) {
    var known = keys.filter(function (key) { return !!LINES[key]; });
    if (!known.length) return;
    var at = 0;
    function next() {
      if (at >= known.length) {
        voiceNow = null;
        return;
      }
      var clip = clipFor(known[at++]);
      voiceNow = clip;
      clip.currentTime = 0;
      clip.addEventListener('ended', function once() {
        clip.removeEventListener('ended', once);
        if (voiceNow === clip) next();
      });
      var playback = clip.play();
      if (playback && playback.catch) {
        playback.catch(function () {
          voiceNow = null;
          speak(known);
        });
      }
    }
    next();
  }

  /** Reads a stitched run of clips, dropping back to one clip at a time. */
  function playRun(keys) {
    var joined = joinClips(keys);
    if (!joined) {
      playClips(keys);
      return;
    }
    var run = ++readOutRun;
    joined.then(function (src) {
      if (run !== readOutRun) return;
      var clip = new window.Audio(src);
      voiceNow = clip;
      clip.addEventListener('ended', function () {
        if (voiceNow === clip) voiceNow = null;
      });
      var playback = clip.play();
      if (playback && playback['catch']) {
        playback['catch'](function () {
          voiceNow = null;
          speak(keys);
        });
      }
    })['catch'](function () {
      if (run === readOutRun) playClips(keys);
    });
  }

  /** The parts of the season read-out, in the order the ranger says them. */
  function resultKeys(wonByPlayer, days) {
    var line = wonByPlayer ? 'result-win' : 'result-loss';
    return [line, 'count-' + days, line + '-end'];
  }

  var api = {
    LINES: LINES,

    isEffectsOn: function () { return prefs.effects; },
    isVoiceOn: function () { return prefs.voice; },

    setEffects: function (on) {
      prefs.effects = !!on;
      save();
    },

    setVoice: function (on) {
      prefs.voice = !!on;
      if (!prefs.voice) api.stopVoice();
      save();
    },

    /** Unlock playback on the first gesture, so later cues are not blocked. */
    unlock: function () {
      audioContext();
    },

    effect: function (name, detail) {
      if (!prefs.effects) return;
      var fn = EFFECTS[name];
      if (fn) fn(detail);
    },

    stopVoice: function () {
      queued = null;
      readOutRun++;
      if (voiceNow) {
        voiceNow.pause();
        voiceNow.currentTime = 0;
        voiceNow = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    },

    /** Follow the line already playing rather than cutting it off. */
    sayAfter: function (key) {
      if (!prefs.voice || !LINES[key]) return;
      if (!voiceNow || voiceNow.paused || voiceNow.ended) {
        api.say(key);
        return;
      }
      queued = key;
      var playing = voiceNow;
      playing.addEventListener('ended', function once() {
        playing.removeEventListener('ended', once);
        if (queued !== key) return;
        queued = null;
        api.say(key);
      });
    },

    say: function (key) {
      if (!prefs.voice || !LINES[key]) return;
      api.stopVoice();
      playClips([key]);
    },

    /**
     * The season read out: the winner, the day count, and the invitation
     * to review the race or run another season.
     */
    sayResult: function (wonByPlayer, days) {
      if (!prefs.voice) return;
      api.stopVoice();
      playRun(resultKeys(wonByPlayer, days));
    },

    /** Builds the read-out while the result is still being called. */
    prepareResult: function (wonByPlayer, days) {
      if (!prefs.voice) return;
      joinClips(resultKeys(wonByPlayer, days));
    }
  };

  window.CaliforniaFiveAudio = api;
})();
