/* dataset.js — typed, indexed view over window.EM_DATA
   (port of enc_roller/data/loader.py + dataset.py). Ranges decoded through
   EM.parseRange with the die PINNED; tiling anomalies recorded as warnings. */
(function () {
  "use strict";
  const EM = (globalThis.EM = globalThis.EM || {});
  const CATCHALL = /roll on\s+(the\s+)?table\s*[RS]3/i;

  function tileCheck(rows, die, label, warnings) {
    const ordered = rows.slice().sort((a, b) =>
      a.roll_low - b.roll_low || a.roll_high - b.roll_high);
    let expect = 1;
    for (const r of ordered) {
      if (r.roll_low > expect) warnings.push(`${label}: gap at ${expect}-${r.roll_low - 1}`);
      else if (r.roll_low < expect) warnings.push(`${label}: overlap at ${r.roll_low}-${expect - 1}`);
      expect = Math.max(expect, r.roll_high + 1);
    }
    if (expect - 1 < die) warnings.push(`${label}: gap at ${expect}-${die} (tail)`);
  }

  function findRow(rows, roll) {
    // rows sorted asc by roll_low, non-overlapping -> binary search
    let lo = 0, hi = rows.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].roll_low <= roll) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    if (ans < 0) return null;
    const r = rows[ans];
    return (r.roll_low <= roll && roll <= r.roll_high) ? r : null;
  }

  EM.Dataset = class Dataset {
    constructor(raw) {
      const warnings = [];
      this._warnings = warnings;

      // ---- items (d1000) grouped by table, sorted -----------------------
      this.itemsByTable = {};
      for (const it of raw.items) {
        (this.itemsByTable[it.table] || (this.itemsByTable[it.table] = [])).push(it);
      }
      for (const t of Object.keys(this.itemsByTable)) {
        this.itemsByTable[t].sort((a, b) => a.roll_low - b.roll_low);
        tileCheck(this.itemsByTable[t], 1000, "item table " + t, warnings);
      }

      // ---- master (die pinned d100, parse from roll string) -------------
      this.masterRows = raw.master.map((r) => {
        const [lo, hi] = EM.parseRange(r.roll, 100);
        return { roll: r.roll, roll_low: lo, roll_high: hi, name: r.name || "", target: r.target || "" };
      }).sort((a, b) => a.roll_low - b.roll_low);
      tileCheck(this.masterRows, 100, "master", warnings);

      // ---- mechanics R1/R2/S1/S2 ----------------------------------------
      const pinned = { R1: 1000, R2: 20, S1: 1000, S2: 20 };
      this.mech = {};
      for (const key of Object.keys(pinned)) {
        const die = pinned[key];
        this.mech[key] = (raw.mech[key] || []).map((r) => {
          const [lo, hi] = EM.parseRange(r.roll, die);
          const name = r.name || "";
          return {
            table: key, roll: r.roll, roll_low: lo, roll_high: hi, name: name,
            reroll: !!r.reroll, is_r3_catchall: CATCHALL.test(name),
            wpn_adj: r.wpn_adj || null,
          };
        }).sort((a, b) => a.roll_low - b.roll_low);
        tileCheck(this.mech[key], die, key, warnings);
      }

      // ---- artifact power tables ----------------------------------------
      this.powerByNum = {};
      for (const t of raw.powerTables) {
        const die = t.die | 0;
        const entries = t.entries.map((e) => {
          let [lo, hi] = EM.parseRange(e.roll, die);
          if (hi < lo) { warnings.push(`power ${t.num}: backwards range ${e.roll} -> swapped`); [lo, hi] = [hi, lo]; }
          return { roll: e.roll, roll_low: lo, roll_high: hi, text: e.text || "", name: e.text || "" };
        }).sort((a, b) => a.roll_low - b.roll_low);
        this.powerByNum[t.num] = { num: t.num, category: t.category || "", die: die, entries: entries, note: t.note || null };
        tileCheck(entries, die, "power " + t.num, warnings);
      }

      // ---- enhancement selector (d100) ----------------------------------
      const ed = raw.enhancement;
      const edie = ed.die | 0 || 100;
      this.enhancement = ed.entries.map((e) => {
        const [lo, hi] = EM.parseRange(e.roll, edie);
        return { roll: e.roll, roll_low: lo, roll_high: hi, type: e.type || "", name: e.type || "", reroll: !!e.reroll };
      }).sort((a, b) => a.roll_low - b.roll_low);
      tileCheck(this.enhancement, edie, "enhancement", warnings);
      this.enhancementDescriptions = ed.descriptions || [];

      // ---- search index (name+category+table+subcategory+page) ----------
      this._search = [];
      for (const t of Object.keys(this.itemsByTable)) {
        for (const it of this.itemsByTable[t]) {
          const hay = [it.name, it.category, it.table, it.subcategory || "",
            it.page == null ? "" : (Array.isArray(it.page) ? it.page.join(" ") : it.page)]
            .join(" ").toLowerCase();
          this._search.push([it, hay]);
        }
      }
    }

    get itemCount() { return this._search.length; }

    find(rows, roll) { return rows && rows.length ? findRow(rows, roll) : null; }

    findNearest(rows, roll) {
      if (!rows || !rows.length) return [null, "no rows"];
      let best = null, bestDist = null;
      for (const r of rows) {
        let dist;
        if (roll < r.roll_low) dist = r.roll_low - roll;
        else if (roll > r.roll_high) dist = roll - r.roll_high;
        else return [r, "exact"];
        if (bestDist === null || dist < bestDist) { best = r; bestDist = dist; }
      }
      return [best, `nearest range ${best.roll_low}-${best.roll_high}`];
    }

    search(tokens) {
      const toks = tokens.map((t) => t.toLowerCase()).filter((t) => t.length);
      if (!toks.length) return this._search.map((x) => x[0]);
      return this._search.filter(([, hay]) => toks.every((t) => hay.indexOf(t) !== -1)).map((x) => x[0]);
    }

    dataWarnings() { return this._warnings.slice(); }
  };
})();
