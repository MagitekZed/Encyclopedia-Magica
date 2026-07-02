/* result.js — the trace-tree renderer (signature feature) + ResultView
   (headline reveal, dice-cast choreography, footer, back-stack). */
(function () {
  "use strict";
  const UI = (window.EMUI = window.EMUI || {});
  const el = UI.el;

  const STAR = { roll: "●", reroll: "⟳", enhancement: "✦", assembly: "⬡", cap: "⊘", gap: "◌" };
  const audio = () => window.EMAudio;

  function tidText(step) {
    if (!step.table) return "";
    if (step.table.indexOf("power:") === 0) return step.table.slice(6);
    if (step.table === "enh") return "EE";
    if (step.table === "master") return "d100";
    return step.table;
  }

  // ---- trace tree ----------------------------------------------------------
  function buildNode(step, order) {
    const row = el("div", { class: "trace-node", "data-kind": step.kind, role: "treeitem" });
    const hasKids = step.children && step.children.length;
    const caret = el("button", { class: "caret", type: "button",
      tabindex: hasKids ? "0" : "-1", "aria-label": hasKids ? "Toggle this branch" : "" });
    caret.textContent = hasKids ? "▾" : "";
    if (!hasKids) caret.setAttribute("aria-hidden", "true");
    if (hasKids) {
      row.setAttribute("aria-expanded", "true");
      caret.addEventListener("click", () => {
        const collapsed = row.classList.toggle("collapsed");
        row.setAttribute("aria-expanded", String(!collapsed));
      });
    }
    row.append(caret);
    row.append(el("span", { class: "star", text: STAR[step.kind] || "●" }));
    row.append(el("span", { class: "tid", text: (step.table && step.die) ? tidText(step) : "" }));
    row.append(el("span", { class: "roll", text: (step.table && step.die) ? window.EM.whereText(step) : "" }));
    row.append(el("span", { class: "lbl", text: step.label }));
    const pg = window.EM.pageText(step);
    row.append(el("span", { class: "pg" + (pg && pg !== "not in index" ? "" : " none"), text: pg ? "(" + pg + ")" : "" }));
    if (step.note) row.append(el("div", { class: "note", text: step.note }));
    order.push(row);

    const wrap = el("div", { class: "trace-node-wrap" });
    wrap.append(row);
    if (hasKids) {
      const kids = el("div", { class: "trace-children", role: "group" });
      for (const c of step.children) kids.append(buildNode(c, order));
      wrap.append(kids);
    }
    return wrap;
  }

  UI.renderTrace = function (root, opts) {
    opts = opts || {};
    const container = el("div", { class: "trace", role: "tree", "aria-label": "Roll explanation" });
    const order = [];
    container.append(buildNode(root, order));
    if (opts.animate) {
      const stagger = order.length > 18 ? 45 : 120;
      order.forEach((n, i) => {
        if (i < 40) { n.classList.add("ignite"); n.style.animationDelay = (i * stagger) + "ms"; }
      });
    }
    return { el: container, order: order, stagger: order.length > 18 ? 45 : 120 };
  };

  // ---- hoard manifest ------------------------------------------------------
  // The illuminated ledger: one glanceable row per hoard item (resolved name,
  // category, provenance, page refs), full trace lazily mounted on expand.
  let maniSeq = 0;   // unique ids — result panel and grimoire popup can coexist

  // Legacy persisted hoards predate root.summary — backfill from the engine
  // (headline() is pure over the tree); the fix persists on the next save().
  UI.ensureHoardSummaries = function (root, engine) {
    for (const m of root.children || []) {
      if (!m.summary) {
        try { m.summary = engine ? engine.headline(m) : m.label; }
        catch (e) { m.summary = m.label; }
      }
    }
  };

  UI.renderHoardManifest = function (root, opts) {
    opts = opts || {};
    if (opts.engine) UI.ensureHoardSummaries(root, opts.engine);
    const items = window.EM.hoardItems(root);
    const seq = ++maniSeq;
    const wrap = el("div", { class: "manifest" });

    // summary bar (toolbar OUTSIDE the list for ARIA correctness)
    const combined = window.EM.countKinds(root, new Set(["reroll", "enhancement"]));
    const enchanted = window.EM.countKinds(root, new Set(["enhancement"]));
    let sumText = items.length + " item" + (items.length === 1 ? "" : "s");
    if (combined) sumText += " · " + combined + " combined";
    if (enchanted) sumText += " · " + enchanted + " enchanted";
    const sum = el("div", { class: "mani-sum" }, [el("span", { class: "hex", "aria-hidden": "true", text: "⬡ " }), sumText]);
    const allBtn = el("button", { class: "btn btn-ghost mani-all", type: "button", text: "Expand all traces" });
    const bar = el("div", { class: "mani-bar" }, [sum, allBtn]);
    const list = el("div", { class: "mani-list", role: "list", "aria-label": root.label });
    wrap.append(bar, list);

    const heads = [];
    function syncAll() {   // stateless: recomputed from the DOM, can never desync
      const hs = list.querySelectorAll(".mani-head");
      let all = hs.length > 0;
      hs.forEach((h) => { if (h.getAttribute("aria-expanded") !== "true") all = false; });
      allBtn.textContent = all ? "Collapse all traces" : "Expand all traces";
    }
    function toggle(head, detail, m, open) {
      const want = open != null ? open : head.getAttribute("aria-expanded") !== "true";
      if (want && !detail.dataset.built) {
        detail.append(UI.renderTrace(m, {}).el);
        detail.dataset.built = "1";
      }
      head.setAttribute("aria-expanded", String(want));
      head.classList.toggle("open", want);
      detail.hidden = !want;
      syncAll();
    }

    items.forEach(function (it, i) {
      const hid = "mani-h-" + seq + "-" + i, did = "mani-d-" + seq + "-" + i;
      const head = el("button", { class: "mani-head", type: "button", id: hid,
        "aria-expanded": "false", "aria-controls": did });
      head.append(el("span", { class: "caret", "aria-hidden": "true", text: "▾" }));
      head.append(el("span", { class: "idx mono", text: String(it.n).padStart(2, "0") }));
      const main = el("span", { class: "m-main" });
      main.append(el("span", { class: "m-name", text: it.name }));
      if (it.marks) main.append(el("span", { class: "count-badge", text: " · " + it.marks }));  // NOT aria-hidden: the accessible flag carrier
      if (it.flags.cap) main.append(el("span", { class: "sr-only", text: " · reroll cap reached" }));
      head.append(main);
      const meta = el("span", { class: "m-meta" });
      if (it.cat) meta.append(el("span", { class: "m-cat", text: it.cat }));
      const inner = (it.node.children || [])[0];
      let prov = window.EM.whereText(it.node);
      if (inner && inner.die) prov += " · " + tidText(inner) + " " + window.EM.whereText(inner).replace(/^d\d+ → /, "→ ");
      if (prov) meta.append(el("span", { class: "m-roll mono", text: prov }));
      const fl = el("span", { class: "m-flags", "aria-hidden": "true" });   // decorative: badge + sr-only carry the info
      if (it.flags.reroll) fl.append(el("span", { "data-kind": "reroll", text: "⟳" }));
      if (it.flags.enh) fl.append(el("span", { "data-kind": "enhancement", text: "✦" }));
      if (it.flags.cap) fl.append(el("span", { "data-kind": "cap", text: "⊘" }));
      if (fl.childNodes.length) meta.append(fl);
      head.append(meta);
      const pg = el("span", { class: "m-pg mono" });
      if (it.pages.length) {
        pg.append(document.createTextNode(it.pages[0]));
        if (it.pages.length > 1) pg.append(el("span", { class: "more", text: " +" + (it.pages.length - 1) }));
      } else if (it.unindexed) {
        pg.className += " unindexed"; pg.textContent = "not in index";
      } else {
        pg.textContent = "—"; pg.append(el("span", { class: "sr-only", text: " no page reference" }));
      }
      head.append(pg);

      const detail = el("div", { class: "mani-detail", id: did, role: "group", "aria-labelledby": hid });
      detail.hidden = true;
      head.addEventListener("click", () => toggle(head, detail, it.node));
      const item = el("div", { class: "mani-item" + (it.gap ? " gap" : ""), role: "listitem" }, [head, detail]);
      list.append(item);
      heads.push({ head: head, detail: detail, node: it.node });
    });

    allBtn.addEventListener("click", () => {
      const expand = allBtn.textContent === "Expand all traces";
      heads.forEach((h) => toggle(h.head, h.detail, h.node, expand));
    });

    // roving arrows through the ledger rows
    list.addEventListener("keydown", (e) => {
      if (!e.target.classList || !e.target.classList.contains("mani-head")) return;
      const hs = Array.from(list.querySelectorAll(".mani-head"));
      const i = hs.indexOf(e.target);
      let j = null;
      if (e.key === "ArrowDown") j = Math.min(hs.length - 1, i + 1);
      else if (e.key === "ArrowUp") j = Math.max(0, i - 1);
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = hs.length - 1;
      else return;
      e.preventDefault(); hs[j].focus();
    });

    const order = heads.map((h) => h.head);
    const stagger = order.length > 18 ? 45 : 120;   // same contract as renderTrace
    if (opts.animate) {
      order.forEach((n, i) => {
        if (i < 40) { n.classList.add("ignite"); n.style.animationDelay = (i * stagger) + "ms"; }
      });
    }
    return { el: wrap, order: order, stagger: stagger };
  };

  function firstRolled(step) {
    if (step.die && step.rolled) return { die: step.die, rolled: step.rolled };
    for (const c of step.children) { const r = firstRolled(c); if (r) return r; }
    return null;
  }
  function isCursed(result) {
    return /(^|\s)-\d/.test(result.headline);
  }

  // ---- ResultView ----------------------------------------------------------
  UI.ResultView = function (mount, ctrl) {
    const card = el("div", { class: "panel glass result-card" });
    const result = el("div", { class: "result" });
    card.append(result);
    mount.append(card);

    const catglyph = el("div", { class: "catglyph", "aria-hidden": "true" });
    const headline = el("h2", { class: "headline" });
    const srLive = el("div", { class: "sr-only", "aria-live": "polite", "aria-atomic": "true" });
    const bannerSlot = el("div", {});
    const castStage = el("div", { class: "cast-stage", "aria-hidden": "true" });
    const divider = el("div", { class: "divider hidden", "aria-hidden": "true" });
    const traceMount = el("div", {});
    const footer = el("div", { class: "footer hidden" });
    result.append(catglyph, castStage, headline, srLive, bannerSlot, divider, traceMount, footer);

    const seedline = el("div", { class: "seedline" });
    const btnCopy = el("button", { class: "btn btn-ghost", text: "Copy" });
    const btnReroll = el("button", { class: "btn btn-ghost", html: "⟳ Reroll" });
    const btnReplay = el("button", { class: "btn btn-ghost", html: "↺ Replay" });
    const btnBack = el("button", { class: "btn btn-ghost", text: "← Previous", disabled: "" });
    footer.append(seedline, btnBack, btnReplay, btnReroll, btnCopy);

    let current = null, backStack = [];
    let castIv = null, castTimers = [];
    function cancelCast() {
      if (castIv) { clearInterval(castIv); castIv = null; }
      castTimers.forEach(clearTimeout); castTimers = [];
      castStage.innerHTML = ""; document.body.classList.remove("aurora-boost");
    }
    btnCopy.addEventListener("click", () => doCopy());
    btnReroll.addEventListener("click", () => ctrl.reroll());
    btnReplay.addEventListener("click", () => ctrl.replay());
    btnBack.addEventListener("click", () => goBack());

    function doCopy() {
      if (!current) return;
      const txt = window.EM.resultToText(current.result.headline, current.result.root, current.seed);
      ctrl.copyText(txt, "Result copied to clipboard.");
    }

    function setHeadline(res) {
      headline.innerHTML = "";
      const h = res.headline;
      const dot = h.indexOf("  ·  ");
      const base = dot >= 0 ? h.slice(0, dot) : h;
      const badge = dot >= 0 ? h.slice(dot) : "";
      // gold-color a leading +N / -N bonus
      const m = /^([+-]\d+)\s(.*)$/.exec(base);
      if (m) { headline.append(el("span", { class: "plus", text: m[1] }), " " + m[2]); }
      else headline.append(document.createTextNode(base));
      if (badge) headline.append(el("span", { class: "count-badge", "aria-hidden": "true", text: badge.trim() }));
    }

    function reveal(res, seed, index) {
      setHeadline(res);
      srLive.textContent = res.headline + (isCursed(res) ? " (cursed)" : "");
      catglyph.innerHTML = ""; catglyph.append(UI.glyph(UI.glyphFor(res.root)));
      bannerSlot.innerHTML = "";
      if (res.root.kind === "gap") bannerSlot.append(makeBanner(res));
      divider.classList.remove("hidden");
      const t = res.root.table === "hoard"
        ? UI.renderHoardManifest(res.root, { animate: ctrl.animate(), engine: ctrl.engine })
        : UI.renderTrace(res.root, { animate: ctrl.animate() });
      traceMount.innerHTML = ""; traceMount.append(t.el);
      seedline.innerHTML = "";
      seedline.append(UI.sigil(seed, 18));
      seedline.append(document.createTextNode("seed " + (seed == null ? "—" : seed) + " · #" + index));
      footer.classList.remove("hidden");
      result.classList.add("reveal");
      setTimeout(() => result.classList.remove("reveal"), 800);
      // sound: cascade arpeggio + specials
      if (audio()) {
        const combines = window.EM.countKinds(res.root, new Set(["reroll", "enhancement"]));
        for (let i = 0; i < combines; i++) setTimeout(() => audio().play("cascade", { index: i }), 300 + i * t.stagger);
        if (isCursed(res)) audio().play("cursed");
      }
      if (isCursed(res)) { card.classList.add("cursed"); ctrl.cosmicEvent("cursed"); }
      else card.classList.remove("cursed");
      const fr = firstRolled(res.root);
      if (fr && fr.rolled === fr.die && (fr.die === 20 || fr.die === 100 || fr.die === 1000)) ctrl.cosmicEvent("supernova");
    }

    function show(res, seed, index, opts) {
      opts = opts || {};
      cancelCast();                         // snap any in-flight cast (fast play never queues)
      if (opts.pushBack !== false && current) { backStack.push(current); btnBack.disabled = false; }
      current = { result: res, seed: seed, index: index };
      const fr = firstRolled(res.root);
      if (opts.animate !== false && ctrl.animate() && fr) {
        playCast(fr.die, fr.rolled, () => reveal(res, seed, index));
      } else {
        reveal(res, seed, index);
      }
    }

    function playCast(die, finalRolled, onDone) {
      castStage.innerHTML = "";
      const d = el("div", { class: "cast-die spin" }, [el("div", { class: "poly" })]);
      castStage.append(d);
      const poly = d.querySelector(".poly");
      if (audio()) audio().play("windup");
      document.body.classList.add("aurora-boost");
      let t = 0;
      castIv = setInterval(() => {
        poly.textContent = window.EM.fmtRoll(die, 1 + Math.floor(Math.random() * die));
        if (audio()) audio().play("tick", { decay: Math.min(1, t / 600) });
        t += 55;
      }, 55);
      castTimers.push(setTimeout(() => {
        if (castIv) { clearInterval(castIv); castIv = null; }
        poly.textContent = window.EM.fmtRoll(die, finalRolled);
        castStage.append(el("div", { class: "shockwave" }));
        if (audio()) audio().play("resolve", { die: die });
        castTimers.push(setTimeout(() => {
          castStage.innerHTML = "";
          document.body.classList.remove("aurora-boost");
          onDone();
        }, 240));
      }, 560));
    }

    function makeBanner(res) {
      const b = el("div", { class: "banner", role: "note" });
      b.append(el("div", { class: "b-copy", text: res.root.label + " — choose a category, or reroll within range." }));
      const cat = el("select", { class: "select", "aria-label": "Pick a category" });
      cat.append(el("option", { value: "", text: "Pick category…" }));
      ctrl.ds.masterRows.forEach((mr) => cat.append(el("option", { value: mr.target, text: mr.name })));
      cat.addEventListener("change", () => {
        if (cat.value) { ctrl.selectTab("single"); ctrl.tabs.single.selectKey(cat.value); ctrl.tabs.single.rollDefault(); }
      });
      b.append(cat);
      return b;
    }

    function goBack() {
      if (!backStack.length) return;
      const prev = backStack.pop();
      current = prev;
      reveal(prev.result, prev.seed, prev.index);
      if (!backStack.length) btnBack.disabled = true;
    }

    return { el: card, show: show, current: () => current, back: goBack };
  };
})();
