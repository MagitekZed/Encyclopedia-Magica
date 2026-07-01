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

  EM.resultToText = function (headline, root, seed) {
    const lines = [headline, ""];
    lines.push.apply(lines, EM.traceLines(root));
    if (seed !== null && seed !== undefined) { lines.push("", "seed " + seed); }
    return lines.join("\n");
  };
})();
