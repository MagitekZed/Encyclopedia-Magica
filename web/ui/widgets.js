/* widgets.js — small reusable UI atoms: die badge, seed sigil, category glyph. */
(function () {
  "use strict";
  const UI = (window.EMUI = window.EMUI || {});

  const el = (UI.el = function (tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach((c) => c != null && n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  });

  // Accessible modal: role=dialog, aria-modal, focus move + trap + Esc + restore.
  UI.openModal = function (dialog, opts) {
    opts = opts || {};
    const prev = document.activeElement;
    const ov = el("div", { class: "overlay" });
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("tabindex", "-1");
    if (opts.label) dialog.setAttribute("aria-label", opts.label);
    ov.append(dialog);
    const SEL = 'a[href],button:not([disabled]),select,input,textarea,[tabindex]:not([tabindex="-1"])';
    const closeBtn = el("button", { class: "dialog-close", type: "button", "aria-label": "Close" });
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", function () { close(); });
    dialog.prepend(closeBtn);                 // visible ✕ (essential on touch — no Esc key)
    document.body.append(ov);
    function close() {
      ov.remove(); document.removeEventListener("keydown", onKey, true);
      if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
    }
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key === "Tab") {
        const f = dialog.querySelectorAll(SEL);
        if (!f.length) { e.preventDefault(); return; }
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    }
    document.addEventListener("keydown", onKey, true);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    const target = dialog.querySelector("input,select,textarea") || dialog.querySelector(SEL) || dialog;
    setTimeout(() => { try { target.focus(); } catch (e) {} }, 0);
    return { overlay: ov, close: close };
  };

  UI.dieBadge = function (die) {
    const b = el("span", { class: "diebadge", "data-die": String(die || 0), "aria-hidden": "true" });
    b.append(el("span", { class: "shape" }), el("span", { class: "lbl", text: die ? "d" + die : "—" }));
    return b;
  };

  // ---- seed sigil: a deterministic constellation glyph from a numeric seed ---
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  UI.sigil = function (seed, size) {
    size = size || 22;
    const s = svgEl("svg", { viewBox: "0 0 32 32", width: size, height: size, class: "sigil" });
    if (seed == null) { s.append(svgEl("circle", { cx: 16, cy: 16, r: 2, fill: "var(--mist-faint)" })); return s; }
    const rnd = mulberry32((seed >>> 0) ^ 0x9e3779b9);
    const n = 4 + Math.floor(rnd() * 3);              // 4-6 stars
    const pts = [];
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2, rad = 7 + rnd() * 7;
      pts.push([16 + Math.cos(ang) * rad, 16 + Math.sin(ang) * rad]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      s.append(svgEl("line", { x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1],
        stroke: "var(--astral-blue)", "stroke-width": 0.7, "stroke-opacity": 0.6 }));
    }
    for (const p of pts) {
      s.append(svgEl("circle", { cx: p[0], cy: p[1], r: 1.4 + rnd() * 1.1, fill: "var(--gold)" }));
    }
    return s;
  };

  // ---- category glyph (small monochrome SVG) ---------------------------------
  const GLYPHS = {
    flask: "M13 3h6M14 3v6l-6 10a3 3 0 0 0 3 5h9a3 3 0 0 0 3-5l-6-10V3",
    scroll: "M7 6h14a2 2 0 0 1 0 4H9M9 10v12a2 2 0 0 1-4 0V8a2 2 0 0 1 2-2h14",
    ring: "M16 8a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM16 4l3 4h-6z",
    wand: "M6 26L22 10M20 6l2 2 2-2-2-2zM24 12l1 1M12 6l1 1",
    book: "M6 6h9v20H8a2 2 0 0 1-2-2zM26 6h-9v20h7a2 2 0 0 0 2-2z",
    gem: "M10 6h12l5 7-11 13L5 13z",
    blade: "M8 26l3-3M11 23l11-15 2 6-13 12zM8 26l3-1",
    shield: "M16 4l10 4v7c0 7-5 11-10 13-5-2-10-6-10-13V8z",
    radiant: "M16 4v6M16 22v6M4 16h6M22 16h6M8 8l4 4M24 8l-4 4M8 24l4-4M24 24l-4-4",
    star: "M16 4l3 9h9l-7 6 3 9-8-6-8 6 3-9-7-6h9z",
    /* header instrument glyphs (house 32x32 / stroke-1.4 / currentColor language) */
    lockOpen: "M11 15v-4a5 5 0 0 1 9.6-1.9M8 15h16v12H8zM16 20.5v3.5",
    lockClosed: "M11 15v-4a5 5 0 0 1 10 0v4M8 15h16v12H8zM16 20.5v3.5",
    note: "M12 24V7l11-2.5V21M12 24a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM23 21a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
    noteMuted: "M12 24V7l11-2.5V21M12 24a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM23 21a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM5 5l22 22",
    gear: "M16 11.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM16 3.5v4.2M16 24.3v4.2M3.5 16h4.2M24.3 16h4.2M7.2 7.2l3 3M21.8 21.8l3 3M24.8 7.2l-3 3M10.2 21.8l-3 3",
    dots: "M8.5 16h.01M16 16h.01M23.5 16h.01",
  };
  UI.glyph = function (name, size, strokeWidth) {
    size = size || 26;
    const d = GLYPHS[name] || GLYPHS.star;
    const s = svgEl("svg", { viewBox: "0 0 32 32", width: size, height: size, class: "catglyph-svg" });
    s.append(svgEl("path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": strokeWidth || 1.4,
      "stroke-linejoin": "round", "stroke-linecap": "round" }));
    return s;
  };

  // map a RollStep tree -> a category glyph name
  UI.glyphFor = function (root) {
    const byLetter = { A: "flask", B: "scroll", C: "ring", D: "wand", E: "wand", F: "wand",
      G: "book", H: "gem", I: "star", J: "star", K: "shield", L: "flask", M: "gem",
      N: "star", O: "star", P: "star", Q: "star", R3: "shield", S3: "blade", T: "radiant" };
    function walk(s) {
      if (s.table === "armor") return "shield";
      if (s.table === "weapon") return "blade";
      if (s.table === "artifact" || s.table === "hoard" || (s.table && s.table.indexOf("power") === 0) || s.table === "enh") return "radiant";
      if (byLetter[s.table]) return byLetter[s.table];
      if (s.children && s.children.length) return walk(s.children[0]);
      return "star";
    }
    return walk(root);
  };
})();
