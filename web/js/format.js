/* format.js — display conventions (port of enc_roller/ui/format.py).
   Roll padding (1000->"000", 100->"00") and page rendering (int | list | null)
   live only here, never in engine math. */
(function () {
  "use strict";
  const EM = (globalThis.EM = globalThis.EM || {});

  EM.fmtRoll = function (die, rolled) {
    if (!die) return "";                              // synthetic assembly/cap node
    if (die === 1000) return rolled === 1000 ? "000" : String(rolled).padStart(3, "0");
    if (die === 100) return rolled === 100 ? "00" : String(rolled).padStart(2, "0");
    return String(rolled);
  };

  EM.whereText = function (step) {
    if (!step.die) return "";
    return "d" + step.die + " → " + EM.fmtRoll(step.die, step.rolled);
  };

  EM.pageText = function (step) {
    const p = step.page;
    if (step.page_status === "filled" && p !== null && p !== undefined) {
      return Array.isArray(p) ? "pp." + p.join(", ") : "p." + p;
    }
    if (step.page_status === "not_in_index") return "not in index";
    return "";
  };

  EM.traceLines = function (step, depth) {
    depth = depth || 0;
    const indent = "    ".repeat(depth);
    const bits = [];
    if (step.table && step.die) bits.push(step.table + " · " + EM.whereText(step));
    bits.push(step.label);
    const pg = EM.pageText(step);
    if (pg) bits.push("(" + pg + ")");
    let line = indent + bits.filter(Boolean).join(" · ");
    if (step.note) line += "    [" + step.note + "]";
    const out = [line];
    for (const c of step.children) out.push.apply(out, EM.traceLines(c, depth + 1));
    return out;
  };

  /* ---- hoard manifest derivation (engine-free: reads m.summary || m.label) --
     One subtree walk per item; shared by the manifest renderer, Copy and Export
     so all three surfaces serialize a hoard identically. */
  EM.hoardItems = function (root) {
    return (root.children || []).map(function (m, i) {
      const s = m.summary || m.label || "";
      const dot = s.indexOf("  ·  ");
      const name = dot >= 0 ? s.slice(0, dot) : s;
      const marks = dot >= 0 ? s.slice(dot).replace(/^[\s·]+/, "").trim() : "";
      const pages = [], flags = { reroll: false, enh: false, cap: false };
      let unindexed = false;
      (function walk(st) {
        const pg = EM.pageText(st);
        if (pg && pg !== "not in index" && pages.indexOf(pg) < 0) pages.push(pg);
        if (pg === "not in index") unindexed = true;
        if (st.kind === "reroll") flags.reroll = true;
        if (st.kind === "enhancement") flags.enh = true;
        if (st.kind === "cap") flags.cap = true;
        for (const c of st.children || []) walk(c);
      })(m);
      return { n: i + 1, name: name, marks: marks, cat: m.kind === "gap" ? "" : m.label,
               pages: pages, unindexed: unindexed, flags: flags, gap: m.kind === "gap", node: m };
    });
  };

  EM.hoardManifestLines = function (root) {
    return EM.hoardItems(root).map(function (it) {
      const bits = [String(it.n).padStart(2, "0") + ". " + it.name];
      if (it.cat) bits.push(it.cat);
      bits.push(it.pages.length ? it.pages.join(", ") : (it.unindexed ? "not in index" : "no page ref"));
      let line = bits.join(" — ");
      if (it.marks) line += "  ·  " + it.marks;
      return line;
    });
  };

  // One shared block builder so Copy and Export lead with the same manifest.
  EM.hoardBlock = function (root) {
    return EM.hoardManifestLines(root).concat(["", "— full trace —", ""]);
  };

  EM.resultToText = function (headline, root, seed) {
    const lines = [headline, ""];
    if (root.table === "hoard") lines.push.apply(lines, EM.hoardBlock(root));
    lines.push.apply(lines, EM.traceLines(root));
    if (seed !== null && seed !== undefined) { lines.push("", "seed " + seed); }
    return lines.join("\n");
  };
})();
