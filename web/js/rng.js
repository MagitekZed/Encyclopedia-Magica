/* rng.js — the determinism seam (port of enc_roller/engine/dice.py).
   DefaultRoller is a seeded mulberry32 sequence: a locked seed reproduces the
   whole sequence (replay), a new seed gives a fresh run (reroll). */
(function () {
  "use strict";
  const EM = (globalThis.EM = globalThis.EM || {});

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  EM.DefaultRoller = class DefaultRoller {
    constructor(seed) {
      this._seed = (seed === null || seed === undefined)
        ? Math.floor(Math.random() * 0x7fffffff)
        : (seed >>> 0);
      this._r = mulberry32(this._seed);
    }
    roll(die) { return 1 + Math.floor(this._r() * die); }
    get seed() { return this._seed; }
  };

  EM.FixedRoller = class FixedRoller {          // scripted queue, for tests
    constructor(values) { this._q = values.slice(); this._seed = null; }
    roll() {
      if (!this._q.length) throw new Error("FixedRoller exhausted: script more rolls");
      return this._q.shift();
    }
    get seed() { return null; }
  };
})();
