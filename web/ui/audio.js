/* ============================================================================
 * Encyclopedia Magica — "Astral Observatory" synthesized WebAudio engine.
 *
 * Vanilla, dependency-free, no audio asset files: every sound is built live
 * from oscillators, noise buffers and filters. Classic (non-module) script
 * that attaches the global `window.EMAudio`.
 *
 * Public contract (see DESIGN.md §10):
 *   EMAudio.unlock()          lazily create the AudioContext on a user gesture
 *   EMAudio.setMuted(bool)    mute/unmute, persisted to localStorage "em_muted"
 *   EMAudio.isMuted()         -> boolean
 *   EMAudio.play(event, opts) fire a sound; opts optional; never throws
 *
 * Design notes:
 *   - ONE AudioContext, created lazily so we respect autoplay policy.
 *   - Muted by default (localStorage "em_muted", default true when unset).
 *   - Every pitched sound sits on an A-minor pentatonic scale so rapid,
 *     overlapping rolls never clash.
 *   - Everything routes through a shared "cathedral of space" bus: a synthesized
 *     convolver reverb (with a plain feedback-delay fallback) that glues the
 *     palette together.
 *   - Node creation is try/catch-wrapped; a blocked/unsupported context can
 *     never break the app, and play() is always a no-op when muted or dead.
 * ========================================================================== */
(function () {
  "use strict";
  var A = (window.EMAudio = window.EMAudio || {});

  var LS_KEY = "em_muted";
  var MASTER_VOL = 0.42; // global attenuation — this plays on EVERY roll.

  // ---- persisted mute state (default true / muted) -------------------------
  var muted = true;
  try {
    var stored = window.localStorage.getItem(LS_KEY);
    muted = stored === null ? true : stored === "1" || stored === "true";
  } catch (e) { muted = true; }

  // ---- lazily-built graph --------------------------------------------------
  var ctx = null;      // the single AudioContext
  var master = null;   // master gain -> destination
  var dryBus = null;   // direct signal
  var wetSend = null;  // reverb send gain
  var reverb = null;   // convolver (or delay fallback)
  var ready = false;   // graph successfully constructed

  // A minor pentatonic (A C D E G) as frequencies, spanning several octaves.
  // Rapid rolls pull notes from here so nothing ever sounds dissonant.
  var PENTA = [
    110.00, 130.81, 146.83, 164.81, 196.00,       // A2 C3 D3 E3 G3
    220.00, 261.63, 293.66, 329.63, 392.00,       // A3 C4 D4 E4 G4
    440.00, 523.25, 587.33, 659.25, 783.99,       // A4 C5 D5 E5 G5
    880.00                                         // A5
  ];

  // -------------------------------------------------------------------------
  // Graph construction (called once on first successful unlock)
  // -------------------------------------------------------------------------
  function buildGraph() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    try {
      ctx = new Ctor();

      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_VOL;
      master.connect(ctx.destination);

      // Dry path.
      dryBus = ctx.createGain();
      dryBus.gain.value = 0.9;
      dryBus.connect(master);

      // Wet path: a "cathedral" reverb everything can send into.
      wetSend = ctx.createGain();
      wetSend.gain.value = 0.32;
      reverb = makeReverb();
      if (reverb) {
        wetSend.connect(reverb);            // send into the bus
        (reverb._tail || reverb).connect(master); // convolver: self; delay: tail
      } else {
        wetSend.connect(master); // degrade gracefully to dry-ish
      }

      ready = true;
      return true;
    } catch (e) {
      ready = false;
      return false;
    }
  }

  // Try a synthesized-impulse convolver; fall back to a feedback delay.
  function makeReverb() {
    try {
      var conv = ctx.createConvolver();
      conv.buffer = makeImpulse(2.6, 2.4);
      return conv;
    } catch (e) { /* fall through */ }
    try {
      // Feedback-delay fallback that behaves like the convolver: one node is
      // returned and used as BOTH the send-in and the tail-out. Sends into `io`
      // feed the delay loop; the filtered, regenerating tail sums back onto
      // `io` so the caller can connect `io -> master` for the wet return.
      var io = ctx.createGain();
      var delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.14;
      var fb = ctx.createGain();
      fb.gain.value = 0.42;
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      io.connect(delay);      // send in
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);      // regenerate the loop
      // NOTE: the wet return is taken from `io` itself; because sends only ever
      // arrive at `io` and `io` connects onward to `master`, we route the tail
      // through a separate summing gain the caller reads instead.
      var out = ctx.createGain();
      io.connect(out);        // pass-through of the immediate send
      lp.connect(out);        // plus the regenerating tail
      io._tail = out;         // caller connects `reverb._tail || reverb`
      return io;
    } catch (e) { return null; }
  }

  // Exponentially-decaying stereo noise = a plausible cathedral impulse.
  function makeImpulse(seconds, decay) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = ctx.createBuffer(2, len, rate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
  }

  // Short-lived white-noise source buffer.
  function noiseBuffer(seconds) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * seconds));
    var buf = ctx.createBuffer(1, len, rate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // -------------------------------------------------------------------------
  // Small helpers — each returns cleanly and auto-stops (no leaks).
  // -------------------------------------------------------------------------
  function now() { return ctx.currentTime; }

  // Route a per-voice gain node into dry + wet buses.
  function connectVoice(node, wet) {
    node.connect(dryBus);
    if (wetSend) {
      var s = ctx.createGain();
      s.gain.value = wet == null ? 0.5 : wet;
      node.connect(s);
      s.connect(wetSend);
    }
  }

  // A simple enveloped oscillator voice. Stops itself; nodes GC after ended.
  function tone(type, freq, t0, dur, peak, wet, attack) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    var a = attack == null ? 0.008 : attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    connectVoice(g, wet);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    osc.onended = function () { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
    return { osc: osc, gain: g };
  }

  // Snap an arbitrary frequency to the nearest pentatonic degree.
  function snap(freq) {
    var best = PENTA[0], bd = Infinity;
    for (var i = 0; i < PENTA.length; i++) {
      var d = Math.abs(PENTA[i] - freq);
      if (d < bd) { bd = d; best = PENTA[i]; }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Individual voices
  // -------------------------------------------------------------------------
  function sWindup(t) {
    // Filtered-noise whoosh...
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.9);
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1400, t + 0.7);
    bp.Q.value = 0.8;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.16, t + 0.18);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    src.connect(bp); bp.connect(ng); connectVoice(ng, 0.6);
    src.start(t); src.stop(t + 0.9);
    src.onended = function () { try { src.disconnect(); bp.disconnect(); ng.disconnect(); } catch (e) {} };
    // ...+ rising sine sweep 200 -> 600 Hz.
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.65);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    osc.connect(g); connectVoice(g, 0.5);
    osc.start(t); osc.stop(t + 0.8);
    osc.onended = function () { try { osc.disconnect(); g.disconnect(); } catch (e) {} };
  }

  function sTick(t, opts) {
    // Very short quiet FM tick; opts.decay (0..1) thins it as the roll slows.
    var decay = opts && typeof opts.decay === "number" ? opts.decay : 0;
    var vol = 0.06 * (1 - 0.7 * Math.min(1, Math.max(0, decay)));
    var carrier = ctx.createOscillator();
    var modOsc = ctx.createOscillator();
    var modGain = ctx.createGain();
    var g = ctx.createGain();
    carrier.type = "sine"; modOsc.type = "sine";
    carrier.frequency.value = 2400;
    modOsc.frequency.value = 1700;
    modGain.gain.value = 900;
    modOsc.connect(modGain); modGain.connect(carrier.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    carrier.connect(g); connectVoice(g, 0.25);
    carrier.start(t); modOsc.start(t);
    carrier.stop(t + 0.06); modOsc.stop(t + 0.06);
    carrier.onended = function () {
      try { carrier.disconnect(); modOsc.disconnect(); modGain.disconnect(); g.disconnect(); } catch (e) {}
    };
  }

  // Bright bell: two detuned sines + a triangle, pitched by die family.
  function bell(t, base, opts) {
    tone("sine", base, t, 1.6, 0.14, 0.7, 0.006);
    tone("sine", base * 1.005, t, 1.5, 0.10, 0.7, 0.006);   // shimmer detune
    tone("triangle", base * 2, t, 0.9, 0.06, 0.6, 0.004);   // bright partial
  }

  function dieBase(die) {
    // Higher for d20; deep resonant for d100/d1000; mid for d10 and default.
    switch (die) {
      case "d20": return snap(660);
      case "d100":
      case "d1000": return snap(196);
      case "d10": return snap(392);
      case "d12": return snap(523);
      case "d8": return snap(440);
      case "d6": return snap(330);
      case "d4": return snap(294);
      default: return snap(440);
    }
  }

  function sResolve(t, opts) {
    bell(t, dieBase(opts && opts.die), opts);
  }

  function sCascade(t, opts) {
    // Walk UP the pentatonic scale by cascade depth so a run arpeggiates.
    var idx = opts && typeof opts.index === "number" ? opts.index : 0;
    var start = 6; // A3-ish region
    var note = PENTA[Math.min(PENTA.length - 1, start + idx)];
    tone("sine", note, t, 0.9, 0.11, 0.7, 0.006);
    tone("triangle", note * 2, t, 0.5, 0.045, 0.6, 0.004);
  }

  function sCursed(t, opts) {
    // Detuned minor-second dissonant chime in place of the bright bell.
    var base = dieBase(opts && opts.die);
    tone("sine", base, t, 1.3, 0.12, 0.7, 0.006);
    tone("sine", base * 1.06, t, 1.3, 0.11, 0.7, 0.006); // ~minor 2nd clash
    tone("triangle", base * 0.995, t, 1.0, 0.05, 0.6, 0.004);
  }

  function sUiTick(t) {
    // Near-inaudible glassy tink.
    tone("sine", snap(1568), t, 0.14, 0.03, 0.35, 0.002);
  }

  function sIgnite(t) {
    // Faint airy shimmer — keep VERY quiet.
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.5);
    var hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 5000;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(hp); hp.connect(g); connectVoice(g, 0.7);
    src.start(t); src.stop(t + 0.5);
    src.onended = function () { try { src.disconnect(); hp.disconnect(); g.disconnect(); } catch (e) {} };
  }

  function sPin(t) {
    // Warm two-note confirm (up a pentatonic step).
    tone("sine", PENTA[6], t, 0.5, 0.10, 0.5, 0.006);
    tone("sine", PENTA[8], t + 0.09, 0.6, 0.10, 0.5, 0.006);
  }

  function sSupernova(t) {
    // Bright three-note gold arpeggio (natural-max easter egg).
    var notes = [PENTA[10], PENTA[12], PENTA[14]];
    for (var i = 0; i < notes.length; i++) {
      var tt = t + i * 0.085;
      tone("sine", notes[i], tt, 1.1, 0.13, 0.75, 0.005);
      tone("triangle", notes[i] * 2, tt, 0.6, 0.05, 0.6, 0.004);
    }
  }

  var DISPATCH = {
    windup: sWindup,
    tick: sTick,
    resolve: sResolve,
    cascade: sCascade,
    cursed: sCursed,
    uiTick: sUiTick,
    ignite: sIgnite,
    pin: sPin,
    supernova: sSupernova
  };

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  A.unlock = function () {
    try {
      if (!ready) { if (!buildGraph()) return; }
      if (ctx && ctx.state === "suspended" && ctx.resume) {
        ctx.resume().catch(function () {});
      }
    } catch (e) { /* never throw on a user gesture */ }
  };

  A.setMuted = function (m) {
    muted = !!m;
    try { window.localStorage.setItem(LS_KEY, muted ? "1" : "0"); } catch (e) {}
    if (master && ctx) {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.02);
      } catch (e) {}
    }
  };

  A.isMuted = function () { return muted; };

  A.play = function (event, opts) {
    if (muted) return;                 // fully silent when muted
    if (!ready) { A.unlock(); }        // best-effort lazy build
    if (!ready || !ctx) return;
    var fn = DISPATCH[event];
    if (!fn) return;
    try {
      if (ctx.state === "suspended" && ctx.resume) ctx.resume().catch(function () {});
      fn(now() + 0.001, opts || {});
    } catch (e) { /* a single bad sound must never break the app */ }
  };
})();
