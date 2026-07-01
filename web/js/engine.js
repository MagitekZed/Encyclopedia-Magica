/* engine.js — every roll mechanic (faithful port of enc_roller/engine/engine.py).
   Single find-site (matchOrGap); one shared depth cap across item-rerolls, the
   Enchanted-Enhancement selector, and R3/S3 sub-cascades; returns a RollStep tree. */
(function () {
  "use strict";
  const EM = (globalThis.EM = globalThis.EM || {});

  const EE_NAME = "Enchanted Enhancements";
  EM.REROLL_CAP = 3;
  EM.MAX_POWERS_SOFT = 20;

  function step(table, die, rolled, label, page, page_status, extra) {
    const s = {
      table: table, die: die, rolled: rolled, label: label,
      page: (page === undefined ? null : page),
      page_status: page_status || "n/a",
      children: [], kind: "roll", note: null,
    };
    if (extra) Object.assign(s, extra);
    return s;
  }

  EM.walk = function* (node) {
    yield node;
    for (const c of node.children) yield* EM.walk(c);
  };
  EM.countKinds = function (node, kinds) {
    let n = 0;
    for (const x of EM.walk(node)) if (kinds.has(x.kind)) n++;
    return n;
  };

  EM.RollEngine = class RollEngine {
    constructor(ds, roller, opts) {
      opts = opts || {};
      this.ds = ds;
      this.roller = roller;
      this.cap = opts.cap == null ? EM.REROLL_CAP : opts.cap;
      this.pool = opts.pool || null;              // null -> all power tables
    }

    // ---- single find-site ------------------------------------------------
    matchOrGap(rows, roll, table, die, nearest) {
      let row = this.ds.find(rows, roll);
      if (row === null && nearest) {
        const [nr, note] = this.ds.findNearest(rows, roll);
        if (nr) {
          return step(table, die, roll, nr.name, nr.page, nr.page_status || "n/a",
            { kind: "roll", note: `data gap at ${roll}; used nearest (${note})` });
        }
      }
      if (row === null) {
        return step(table, die, roll, "(no entry for roll — data gap)", null, "n/a",
          { kind: "gap", note: "data gap; re-roll this slot" });
      }
      return step(table, die, roll, row.name, row.page, row.page_status || "n/a");
    }

    // ---- Feature 1: single table ----------------------------------------
    rollItemTable(table, depth) {
      depth = depth || 0;
      const rows = this.ds.itemsByTable[table];
      const roll = this.roller.roll(1000);
      const st = this.matchOrGap(rows, roll, table, 1000);
      if (st.kind === "roll") {
        const matched = this.ds.find(rows, roll);
        this.attachCascade(st, matched, table, depth);
      }
      return { kind: "single", headline: this.headline(st), root: st, seed: this.roller.seed };
    }

    rollPowerTable(num) { return this.rollArtifactPower(num); }

    rollMech(key) {
      const die = (key === "R1" || key === "S1") ? 1000 : 20;
      const roll = this.roller.roll(die);
      const st = this.matchOrGap(this.ds.mech[key], roll, key, die, key === "R1" || key === "S1");
      return { kind: "single", headline: st.label, root: st, seed: this.roller.seed };
    }

    rollArmor(depth) { const r = this.assembleArmor(depth || 0); return { kind: "single", headline: this.headline(r), root: r, seed: this.roller.seed }; }
    rollWeapon(depth) { const r = this.assembleWeapon(depth || 0); return { kind: "single", headline: this.headline(r), root: r, seed: this.roller.seed }; }

    rollNamed(key) {
      if (this.ds.itemsByTable[key]) return this.rollItemTable(key);
      if (key === "R") return this.rollArmor();
      if (key === "S") return this.rollWeapon();
      if (this.ds.mech[key]) return this.rollMech(key);
      if (this.ds.powerByNum[key]) return this.rollPowerTable(key);
      throw new Error("unknown roll target " + key);
    }

    attachCascade(st, item, table, depth) {
      if (!item) return;
      if (item.name === EE_NAME) st.children = [this.resolveEnchantedEnhancements(depth + 1)];
      else if (item.reroll) st.children = [this.resolveItem(item, table, depth + 1)];
    }

    // ---- Feature 2: fully random item -----------------------------------
    rollRandomItem() {
      const d = this.roller.roll(100);
      const mrow = this.ds.find(this.ds.masterRows, d);
      if (mrow === null) {
        const hi = this.ds.masterRows.reduce((m, r) => Math.max(m, r.roll_high), 0);
        const root = step("master", 100, d, `No category — source covers d100 1-${hi}`,
          null, "n/a", { kind: "gap", note: "master gap" });
        return { kind: "random_item", headline: "No result — master gap", root: root, seed: this.roller.seed };
      }
      let inner;
      if (mrow.target === "R") inner = this.assembleArmor(0);
      else if (mrow.target === "S") inner = this.assembleWeapon(0);
      else inner = this.rollItemTable(mrow.target, 0).root;
      const root = step("master", 100, d, mrow.name, null, "n/a", { children: [inner] });
      return { kind: "random_item", headline: this.headline(root), root: root, seed: this.roller.seed };
    }

    // ---- Features 3 & 4: artifact powers --------------------------------
    rollArtifactPower(num) {
      const pt = this.pickPowerTable(num);
      const r = this.roller.roll(pt.die);
      const st = this.matchOrGap(pt.entries, r, "power:" + pt.num, pt.die);
      if (st.note === null) st.note = `${pt.category} (${pt.num})`;
      return { kind: "artifact_power", headline: st.label, root: st, seed: this.roller.seed, category: pt.category, num: pt.num };
    }

    generateArtifact(n, tables) {
      if (!Number.isInteger(n) || n < 1) throw new Error("N must be an integer >= 1");
      if (tables != null && tables.length !== n) throw new Error("tables length must equal N");
      const picks = tables != null ? tables : new Array(n).fill(null);
      const children = [];
      for (const t of picks) {
        let child = this.rollArtifactPower(t).root;
        if (child.kind === "gap") child = this.rollArtifactPower(t).root;   // re-roll a hole once
        children.push(child);
      }
      const root = step("artifact", 0, 0, `Artifact — ${n} powers`, null, "n/a",
        { kind: "assembly", children: children });
      if (n > EM.MAX_POWERS_SOFT) root.note = `large artifact (N=${n} > soft cap ${EM.MAX_POWERS_SOFT})`;
      return { kind: "artifact", headline: this.headline(root), root: root, seed: this.roller.seed };
    }

    pickPowerTable(num) {
      if (num != null) return this.ds.powerByNum[num];
      const pool = this.pool || Object.keys(this.ds.powerByNum).sort();
      const idx = this.roller.roll(pool.length) - 1;
      return this.ds.powerByNum[pool[idx]];
    }

    // ---- Bonus: treasure hoard ------------------------------------------
    rollHoard(k) {
      if (!Number.isInteger(k) || k < 1) throw new Error("hoard size must be an integer >= 1");
      const children = [];
      for (let i = 0; i < k; i++) children.push(this.rollRandomItem().root);
      const root = step("hoard", 0, 0, `Treasure Hoard — ${k} items`, null, "n/a",
        { kind: "assembly", children: children });
      return { kind: "hoard", headline: this.headline(root), root: root, seed: this.roller.seed };
    }

    // ---- shared primitives ----------------------------------------------
    resolveItem(item, table, depth) {
      if (item.name === EE_NAME) return this.resolveEnchantedEnhancements(depth);
      if (depth > this.cap) {
        return step(table, 0, 0, "(reroll cap reached)", null, "n/a",
          { kind: "cap", note: `cap (${this.cap}) reached` });
      }
      const rows = this.ds.itemsByTable[table];
      const roll = this.roller.roll(1000);
      const st = this.matchOrGap(rows, roll, table, 1000);
      if (st.kind !== "roll") return st;
      st.kind = "reroll";
      st.note = "reroll → combined";
      const matched = this.ds.find(rows, roll);
      if (matched && matched.name === EE_NAME) {
        st.note = "reroll → Enchanted Enhancements";
        st.children = [this.resolveEnchantedEnhancements(depth + 1)];
      } else if (matched && matched.reroll) {
        st.children = [this.resolveItem(matched, table, depth + 1)];
      }
      return st;
    }

    resolveEnchantedEnhancements(depth) {
      if (depth > this.cap) {
        return step("enh", 0, 0, "(reroll cap reached)", null, "n/a",
          { kind: "cap", note: `cap (${this.cap}) reached` });
      }
      const d = this.roller.roll(100);
      const row = this.ds.find(this.ds.enhancement, d);
      if (!row) {
        return step("enh", 100, d, "(no enhancement for roll — data gap)", null, "n/a",
          { kind: "gap", note: "data gap" });
      }
      const st = step("enh", 100, d, "Enchanted: " + row.type, null, "n/a", { kind: "enhancement" });
      if (row.reroll) st.children = [this.resolveEnchantedEnhancements(depth + 1)];
      return st;
    }

    assembleArmor(depth) { return this.assembleRS("armor", depth || 0); }
    assembleWeapon(depth) { return this.assembleRS("weapon", depth || 0); }

    assembleRS(slot, depth) {
      let t1, t2, itemTable, label;
      if (slot === "armor") { t1 = "R1"; t2 = "R2"; itemTable = "R3"; label = "Armor"; }
      else { t1 = "S1"; t2 = "S2"; itemTable = "S3"; label = "Weapon"; }

      const t = this.roller.roll(1000);
      const typeStep = this.matchOrGap(this.ds.mech[t1], t, t1, 1000, true);
      const matchedType = this.ds.find(this.ds.mech[t1], t);

      if (matchedType && matchedType.is_r3_catchall) {
        // Special -> roll the specific item table (cascades); no generic bonus.
        typeStep.note = "Special → roll on " + itemTable;
        const itemStep = this.rollItemTable(itemTable, depth).root;   // shares outer budget
        return step(slot, 0, 0, label + " (Special)", null, "n/a",
          { kind: "assembly", children: [typeStep, itemStep],
            note: t1 + " Special → specific item from " + itemTable });
      }

      // Generic magic armor/weapon: type + bonus (no R3/S3 roll).
      const b = this.roller.roll(20);
      const bonusStep = this.matchOrGap(this.ds.mech[t2], b, t2, 20);
      if (slot === "weapon" && matchedType && matchedType.name !== "Sword") {
        const mb = this.ds.find(this.ds.mech[t2], b);                 // S2 Wpn Adj for non-swords
        if (mb && mb.wpn_adj) { bonusStep.label = mb.wpn_adj; bonusStep.note = "Wpn Adj (non-sword)"; }
      }
      return step(slot, 0, 0, label, null, "n/a",
        { kind: "assembly", children: [typeStep, bonusStep] });
    }

    bonusPlus(mechKey, name) {
      if (mechKey === "S2") return name.trim();
      const m = /AC Adj\s*([+-]?\d+)/.exec(name);
      if (!m) return name;
      const g = m[1];
      return (g[0] !== "+" && g[0] !== "-") ? "+" + g : g;
    }

    // ---- headline derivation --------------------------------------------
    headline(root) {
      const base = this.primaryName(root);
      if (root.table === "artifact" || root.table === "hoard") return base;
      const combines = EM.countKinds(root, new Set(["reroll", "enhancement"]));
      const ench = EM.countKinds(root, new Set(["enhancement"]));
      if (combines === 0) return base;
      let suffix = "  ·  +" + combines + " combined";
      if (ench) suffix += " (" + ench + " enchanted)";
      return base + suffix;
    }

    primaryName(root) {
      if (root.table === "armor" || root.table === "weapon") return this.assembledName(root);
      if (root.table === "master" && root.children.length) return this.primaryName(root.children[0]);
      return root.label;
    }

    assembledName(root) {
      const typeStep = root.children[0], second = root.children[1];
      if (second.table === "R2" || second.table === "S2") {   // generic: "{bonus} {type}"
        const plus = this.bonusPlus(second.table, second.label);
        return (plus + " " + typeStep.label).trim();
      }
      return this.primaryName(second);                         // Special: the R3/S3 item is the result
    }
  };
})();
