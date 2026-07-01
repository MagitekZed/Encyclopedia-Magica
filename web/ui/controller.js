/* controller.js — app state machine: seed seam, perform/reroll/replay,
   navigation, keyboard, command palette, diagnostics, cosmic events. */
(function () {
  "use strict";
  const UI = (window.EMUI = window.EMUI || {});
  const el = UI.el;

  UI.Controller = function (ds) {
    const C = {
      ds: ds,
      engine: new window.EM.RollEngine(ds, new window.EM.DefaultRoller(null)),
      currentSeed: null, actionCount: 0, lastThunk: null, lastView: null,
      rapid: false, reduceMotion: false,
      tabs: {}, dom: {}, grimoire: null, library: null, sky: null,
    };

    C.animate = function () { return !C.rapid && !C.reduceMotion; };

    function makeRoller() {
      if (C.dom.lock && C.dom.lock.classList.contains("on")) {
        const v = parseInt(C.dom.seed.value, 10);
        return new window.EM.DefaultRoller(Number.isFinite(v) ? v : null);
      }
      return new window.EM.DefaultRoller(null);
    }

    function run(thunk, view, roller, log, count) {
      C.engine.roller = roller;
      let result;
      try { result = thunk(); }
      catch (e) { C.flash(e && e.message ? e.message : String(e)); return null; }
      C.currentSeed = roller.seed; C.lastThunk = thunk; C.lastView = view;
      if (count) C.actionCount++;
      if (C.dom.seed) C.dom.seed.value = roller.seed == null ? "" : String(roller.seed);
      if (C.dom.count) C.dom.count.textContent = "#" + C.actionCount;
      view.show(result, roller.seed, C.actionCount, { animate: C.animate() });
      if (log && C.grimoire) C.grimoire.add(result, roller.seed);
      if (roller.seed != null) { try { history.replaceState(null, "", "#s=" + roller.seed); } catch (e) {} }
      if (window.EMAudio) window.EMAudio.play("uiTick");
      return result;
    }

    C.perform = function (thunk, view) { if (window.EMAudio) window.EMAudio.unlock(); return run(thunk, view, makeRoller(), true, true); };
    C.reroll = function () { if (C.lastThunk) run(C.lastThunk, C.lastView, new window.EM.DefaultRoller(null), true, true); };
    C.replay = function () { if (C.lastThunk && C.currentSeed != null) run(C.lastThunk, C.lastView, new window.EM.DefaultRoller(C.currentSeed), false, false); };

    // ---- navigation ----
    C.selectTab = function (name, focusTab) {
      C.dom.tabs.forEach((t) => {
        const on = t.dataset.tab === name;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
      });
      C.dom.panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === name));
      moveArc();
      if (focusTab) { const a = C.dom.tabs.find((t) => t.dataset.tab === name); if (a) a.focus(); }
      if (window.EMAudio) window.EMAudio.play("uiTick");
    };
    C.bindTabKeys = function () {
      const order = ["random", "single", "artifacts", "library"];
      C.dom.tabs.forEach((t) => t.addEventListener("keydown", (e) => {
        let i = order.indexOf(t.dataset.tab);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") i = (i + 1) % order.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") i = (i - 1 + order.length) % order.length;
        else if (e.key === "Home") i = 0;
        else if (e.key === "End") i = order.length - 1;
        else return;
        e.preventDefault(); C.selectTab(order[i], true);
      }));
    };
    C.cheatsheet = function () {
      const dlg = el("div", { class: "dialog glass" });
      dlg.append(el("h3", { text: "Keyboard Shortcuts" }));
      [["R / Space", "Roll active tab"], ["Ctrl/⌘ R", "Reroll (new seed)"], ["Ctrl/⌘ Z", "Previous result"],
       ["1 – 4", "Switch tabs"], ["Ctrl/⌘ F", "Focus Library search"], ["Ctrl/⌘ H", "Toggle Grimoire"],
       ["Ctrl/⌘ K", "Command palette"], ["Esc", "Clear / close"], ["?", "This help"]].forEach((kv) =>
        dlg.append(el("div", { class: "row" }, [el("span", { class: "k mono", text: kv[0] }), el("span", { text: kv[1] })])));
      UI.openModal(dlg, { label: "Keyboard shortcuts" });
    };
    C.openMore = function () {                 // mobile "⋯" consolidated menu
      const dlg = el("div", { class: "dialog glass" });
      dlg.append(el("h3", { text: "Options" }));
      const wrap = el("div", { class: "more-list" });
      let m;
      function item(label, fn) {
        const b = el("button", { class: "btn btn-ghost more-item", text: label });
        b.addEventListener("click", () => { m.close(); fn(); });
        wrap.append(b);
      }
      item("🎲  Roll Random Item", () => { C.selectTab("random"); C.tabs.random.rollDefault(); });
      item("⌘  Command palette", () => C.openPalette());
      item(C.rapid ? "🐢  Animation → Ritual (full)" : "⚡  Animation → Rapid (fast)", () => C.setRapid(!C.rapid));
      item(C.reduceMotion ? "✨  Effects → on" : "✧  Reduce effects", () => C.setReduce(!C.reduceMotion));
      item((window.EMAudio && !window.EMAudio.isMuted()) ? "♫  Sound → off" : "♪  Sound → on",
        () => C.setMuted(window.EMAudio ? !window.EMAudio.isMuted() : true));
      item("⚙  Diagnostics / self-test", () => C.diagnostics());
      dlg.append(wrap);
      m = UI.openModal(dlg, { label: "Options" });
    };
    function moveArc() {
      const active = C.dom.tabs.find((t) => t.classList.contains("active"));
      if (active && C.dom.arc) { C.dom.arc.style.left = active.offsetLeft + "px"; C.dom.arc.style.width = active.offsetWidth + "px"; }
    }
    C.moveArc = moveArc;
    C.activeTab = function () {
      const active = C.dom.tabs.find((t) => t.classList.contains("active"));
      return active ? C.tabs[active.dataset.tab] : null;
    };

    // ---- feedback ----
    let toastT = null;
    C.flash = function (msg, ok) {
      const t = C.dom.toast; if (!t) return;
      t.textContent = msg; t.className = "toast show" + (ok ? " ok" : "");
      clearTimeout(toastT); toastT = setTimeout(() => t.className = "toast", 3200);
    };
    C.copyText = function (txt, msg) {
      const done = () => C.flash(msg || "Copied.", true);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(done, () => fallback()); }
        else fallback();
      } catch (e) { fallback(); }
      function fallback() {
        const ta = el("textarea", { style: "position:fixed;opacity:0" }); ta.value = txt; document.body.append(ta);
        ta.select(); try { document.execCommand("copy"); done(); } catch (e2) { C.flash("Copy failed."); } ta.remove();
      }
    };
    C.download = function (name, content, mime) {
      try {
        const blob = new Blob([content], { type: mime || "text/plain" });
        const a = el("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
        C.flash("Exported " + name, true);
      } catch (e) { C.flash("Export failed."); }
    };

    // ---- cosmic events ----
    C.cosmicEvent = function (type) {
      if (C.reduceMotion) return;
      if (type === "supernova") {
        const s = el("div", { class: "supernova" }); document.body.append(s);
        setTimeout(() => s.remove(), 950);
        if (window.EMAudio) window.EMAudio.play("supernova");
        C.flash("✦ Natural maximum — a supernova!", true);
      }
    };

    // ---- toggles ----
    C.setRapid = function (b) { C.rapid = b; if (C.dom.ritual) C.dom.ritual.classList.toggle("active", b); };
    C.setReduce = function (b) {
      C.reduceMotion = b; document.body.classList.toggle("reduce-motion", b);
      if (C.sky) C.sky.setReducedMotion(b);
      if (C.dom.reduce) C.dom.reduce.classList.toggle("active", b);
    };
    C.setMuted = function (b) {
      if (window.EMAudio) { window.EMAudio.setMuted(b); if (!b) window.EMAudio.unlock(); }
      if (C.dom.sound) { C.dom.sound.classList.toggle("active", !b); C.dom.sound.textContent = b ? "♪" : "♫"; }
    };
    C.toggleGrimoire = function () {
      const app = C.dom.app;
      if (window.matchMedia("(max-width:1023px)").matches) app.classList.toggle("show-grim");
      else app.classList.toggle("no-grim");
      moveArc();
    };

    // ---- diagnostics ----
    C.diagnostics = function () {
      const r = window.EM.runSelfTest(ds);
      const dlg = el("div", { class: "dialog glass" });
      dlg.append(el("h3", { text: "⚙ Star-Chart Anomalies (self-test)" }));
      const status = el("div", { class: r.ok ? "diag-ok" : "diag-fail",
        text: (r.ok ? "✓ PASS" : "✗ FAIL") + " — " + r.passed + "/" + r.checks.length + " checks" });
      dlg.append(status);
      const warns = ds.dataWarnings();
      const lines = ["Data warnings:"].concat(warns.length ? warns.map((w) => "  • " + w) : ["  (none)"])
        .concat(["", "Failed checks:"])
        .concat(r.checks.filter((c) => !c.pass).map((c) => "  ✗ " + c.name + " — " + c.detail))
        .concat(r.failed ? [] : ["  (none)"]);
      dlg.append(el("pre", { text: lines.join("\n") }));
      UI.openModal(dlg, { label: "Diagnostics self-test" });
    };

    // ---- command palette ----
    C.commands = function () {
      const cmds = [
        { name: "Roll Random Magic Item", run: () => { C.selectTab("random"); C.tabs.random.rollDefault(); } },
        { name: "Generate Artifact", run: () => C.selectTab("artifacts") },
        { name: "Reroll (new seed)", run: () => C.reroll() },
        { name: "Replay (same seed)", run: () => C.replay() },
        { name: "Toggle Grimoire", run: () => C.toggleGrimoire() },
        { name: "Toggle Sound", run: () => C.setMuted(window.EMAudio ? !window.EMAudio.isMuted() : true) },
        { name: "Toggle Reduce Effects", run: () => C.setReduce(!C.reduceMotion) },
        { name: "Diagnostics / Self-test", run: () => C.diagnostics() },
      ];
      ["random", "single", "artifacts", "library"].forEach((t) => cmds.push({ name: "Go to " + t[0].toUpperCase() + t.slice(1) + " tab", run: () => C.selectTab(t) }));
      Object.keys(ds.itemsByTable).sort().forEach((t) =>
        cmds.push({ name: "Roll table " + t, run: () => { C.selectTab("single"); C.tabs.single.selectKey(t); C.tabs.single.rollDefault(); } }));
      Object.keys(ds.powerByNum).sort().forEach((n) =>
        cmds.push({ name: "Roll artifact power " + n, run: () => { C.perform(() => C.engine.rollArtifactPower(n), C.activeTabView()); } }));
      return cmds;
    };
    C.activeTabView = function () { const t = C.activeTab(); return (t && t.view) ? t.view : C.tabs.random.view; };

    C.openPalette = function () {
      const cmds = C.commands();
      const box = el("div", { class: "dialog glass palette" });
      const input = el("input", { type: "text", placeholder: "Type a command or table…", "aria-label": "Command palette" });
      const listEl = el("div", { class: "palette-list", role: "listbox" });
      box.append(input, listEl);
      const m = UI.openModal(box, { label: "Command palette" });
      let sel = 0, filtered = cmds;
      function draw() {
        listEl.innerHTML = "";
        filtered.slice(0, 40).forEach((c, i) => {
          const it = el("div", { class: "palette-item" + (i === sel ? " sel" : ""), text: c.name });
          it.addEventListener("click", () => { m.close(); c.run(); });
          listEl.append(it);
        });
      }
      function filter() { const q = input.value.toLowerCase(); filtered = cmds.filter((c) => c.name.toLowerCase().includes(q)); sel = 0; draw(); }
      input.addEventListener("input", filter);
      input.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { sel = Math.min(filtered.length - 1, sel + 1); draw(); e.preventDefault(); }
        else if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
        else if (e.key === "Enter") { const c = filtered[sel]; m.close(); if (c) c.run(); }
      });
      draw();
    };

    // ---- keyboard ----
    C.bindKeys = function () {
      document.addEventListener("keydown", (e) => {
        const typing = /^(INPUT|SELECT|TEXTAREA)$/.test((e.target.tagName || ""));
        const meta = e.ctrlKey || e.metaKey;
        if (meta && e.key.toLowerCase() === "k") { e.preventDefault(); C.openPalette(); return; }
        if (meta && e.key.toLowerCase() === "r") { e.preventDefault(); C.reroll(); return; }
        if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); const t = C.activeTab(); if (t && t.view && t.view.back) t.view.back(); return; }
        if (meta && e.key.toLowerCase() === "h") { e.preventDefault(); C.toggleGrimoire(); return; }
        if (meta && e.key.toLowerCase() === "f") { e.preventDefault(); C.selectTab("library"); if (C.library) C.library.focusSearch(); return; }
        if (meta) return;
        if (e.key === "Escape") { document.querySelectorAll(".overlay").forEach((o) => o.remove()); if (C.library) C.library.clearSearch(); return; }
        if (typing) return;
        if (e.key === "r" || e.key === "R" || e.key === " ") {
          const t = C.activeTab(); if (t && t.rollCapable) { e.preventDefault(); t.rollDefault(); }
        } else if (e.key >= "1" && e.key <= "4") {
          C.selectTab(["random", "single", "artifacts", "library"][+e.key - 1]);
        } else if (e.key === "?") { C.cheatsheet(); }
      });
    };

    return C;
  };
})();
