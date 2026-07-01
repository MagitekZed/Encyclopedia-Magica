/* ranges.js — the ONLY roll-string decoder (port of enc_roller/data/ranges.py).
   A die is ALWAYS supplied and NEVER inferred from the string (S1's "01-97" is d1000). */
(function () {
  "use strict";
  const EM = (globalThis.EM = globalThis.EM || {});

  function token(tok, die) {
    tok = String(tok).trim();
    if (tok.length === 0) throw new Error("empty roll token");
    if (/^0+$/.test(tok)) return die;          // "0","00","000" -> die max
    const n = parseInt(tok, 10);
    if (!Number.isFinite(n)) throw new Error("bad roll token: " + tok);
    return n;
  }

  // parseRange("953-000",1000)->[953,1000]; ("91-00",100)->[91,100]; ("1",20)->[1,1]
  EM.parseRange = function (s, die) {
    const parts = String(s).trim().split("-");
    if (parts.length === 1) {
      const v = token(parts[0], die);
      return [v, v];
    }
    if (parts.length !== 2) throw new Error("cannot parse roll string " + JSON.stringify(s));
    return [token(parts[0], die), token(parts[1], die)];
  };

  EM.contains = function (low, high, roll) {
    return low <= roll && roll <= high;
  };
})();
