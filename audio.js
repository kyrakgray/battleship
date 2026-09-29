/**
 * Trail sound: synthesized effects and the ranger's recorded lines.
 *
 * Effects are generated with the Web Audio API so the page carries no
 * sample files. Voice lines are pre-rendered mp3s under voice/; if one is
 * missing the browser's own speech synthesis reads the line instead, so
 * the game is never silent where it promised a voice.
 */
(function () {
  'use strict';

  var STORE_KEY = 'california-five-sound';
  var VOICE_DIR = 'voice/';

  /** Every line the ranger speaks, keyed by the moment it belongs to. */
  var LINES = {
    welcome: 'Welcome to The California National Park Summer Classic.',
    briefing: "Before you draw your route, here is a ranger's briefing on how to play.",
    sealed: 'Signed, sealed, and delivered.'
  };
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
    for (var i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
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
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(at);
  }

  var EFFECTS = {
    /** Pencil laying a park down on the paper map. */
    draw: function () {
      noise({ length: 0.22, frequency: 2400, q: 0.8, peak: 0.07 });
      noise({ length: 0.16, frequency: 1500, q: 0.9, peak: 0.05, delay: 0.06 });
    },
    /** A day lost on a forest road. */
    deadEnd: function () {
      tone({ from: 220, to: 96, length: 0.28, type: 'triangle', peak: 0.1 });
      noise({ length: 0.22, frequency: 320, filter: 'lowpass', peak: 0.06 });
    },
    /** A trail marker, pitched to the park it belongs to. */
    marker: function (parkId) {
      var base = PARK_TONES[parkId] || 330;
      tone({ from: base, length: 0.14, type: 'triangle', peak: 0.1 });
      tone({ from: base * 1.5, length: 0.2, type: 'sine', peak: 0.08, delay: 0.1 });
    },
    /** The rubber stamp coming down on the passport page. */
    stamp: function () {
      noise({ length: 0.12, frequency: 900, filter: 'lowpass', peak: 0.16 });
      tone({ from: 150, to: 60, length: 0.22, type: 'square', peak: 0.09 });
      tone({ from: 520, length: 0.3, type: 'sine', peak: 0.06, delay: 0.08 });
    }
  };

  var clips = {};
  var voiceNow = null;

  function clipFor(key) {
    if (!clips[key]) {
      var audio = new window.Audio(VOICE_DIR + key + '.mp3');
      audio.preload = 'auto';
      clips[key] = audio;
    }
    return clips[key];
  }

  /** Last resort when a clip is missing: the browser's own ranger. */
  function speak(key) {
    var synth = window.speechSynthesis;
    if (!synth || !LINES[key]) return;
    var utterance = new window.SpeechSynthesisUtterance(LINES[key]);
    utterance.rate = 0.9;
    utterance.pitch = 0.7;
    synth.cancel();
    synth.speak(utterance);
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
      if (voiceNow) {
        voiceNow.pause();
        voiceNow.currentTime = 0;
        voiceNow = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    },

    say: function (key) {
      if (!prefs.voice || !LINES[key]) return;
      api.stopVoice();
      var clip = clipFor(key);
      voiceNow = clip;
      var playback = clip.play();
      if (playback && playback.catch) {
        playback.catch(function () {
          voiceNow = null;
          speak(key);
        });
      }
    }
  };

  window.CaliforniaFiveAudio = api;
})();
