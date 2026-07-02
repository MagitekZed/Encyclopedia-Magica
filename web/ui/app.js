/* app.js — boot: build dataset -> controller -> UI; wire header + shell. */
(function () {
  "use strict";
  function byId(id) { return document.getElementById(id); }

  function boot() {
    const ds = new window.EM.Dataset(window.EM_DATA);
    const C = window.EMUI.Controller(ds);

    C.dom.app = document.querySelector(".app");
    C.dom.seed = byId("seed"); C.dom.lock = byId("lock"); C.dom.count = byId("count");
    C.dom.toast = byId("toast"); C.dom.arc = byId("tabArc");
    C.dom.sound = byId("sound"); C.dom.ritual = byId("ritual"); C.dom.reduce = byId("reduce");
    C.dom.tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    C.dom.panels = Array.prototype.slice.call(document.querySelectorAll(".tabpanel"));

    // backdrop-filter fallback
    const bf = window.CSS && CSS.supports && (CSS.supports("backdrop-filter", "blur(1px)") || CSS.supports("-webkit-backdrop-filter", "blur(1px)"));
    if (!bf) document.documentElement.classList.add("no-backdrop");

    // tooltips + header instrument glyphs (emoji in markup are pre-boot fallback)
    if (window.EMUI.initTooltips) window.EMUI.initTooltips();
    const G = window.EMUI.glyph;
    byId("diag").textContent = ""; byId("diag").append(G("gear", 18));
    byId("more").textContent = ""; byId("more").append(G("dots", 18, 3.2));
    byId("grim").textContent = ""; byId("grim").append(G("book", 18));
    byId("cmdk").textContent = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘K" : "Ctrl K";

    // tabs / library / grimoire
    C.tabs.random = window.EMUI.buildRandom(byId("panelRandom"), C);
    C.tabs.single = window.EMUI.buildSingle(byId("panelSingle"), C, ds);
    C.tabs.artifacts = window.EMUI.buildArtifacts(byId("panelArtifacts"), C, ds);
    C.library = window.EMUI.Library(byId("panelLibrary"), C, ds);
    C.tabs.library = { view: null, rollCapable: false, rollDefault: function () {} };
    C.grimoire = window.EMUI.Grimoire(byId("grimoire"), C);

    // background
    C.sky = window.EMSky || null;
    try { if (C.sky) C.sky.init(byId("sky")); } catch (e) {}

    // header wiring
    byId("hdrRandom").addEventListener("click", function () { C.selectTab("random"); C.tabs.random.rollDefault(); });
    C.dom.tabs.forEach(function (t) { t.addEventListener("click", function () { C.selectTab(t.dataset.tab); }); });
    C.dom.lock.addEventListener("click", function () { C.setLock(!C.dom.lock.classList.contains("on")); if (window.EMAudio) window.EMAudio.play("uiTick"); });
    byId("cmdk").addEventListener("click", function () { C.openPalette(); });
    C.dom.sound.addEventListener("click", function () { C.setMuted(window.EMAudio ? !window.EMAudio.isMuted() : true); });
    C.dom.ritual.addEventListener("click", function () { C.setRapid(!C.rapid); });
    C.dom.reduce.addEventListener("click", function () { C.setReduce(!C.reduceMotion); });
    byId("diag").addEventListener("click", function () { C.diagnostics(); });
    byId("more").addEventListener("click", function () { C.openMore(); });
    byId("grim").addEventListener("click", function () { C.toggleGrimoire(); });
    var scrim = byId("grimScrim");
    if (scrim) scrim.addEventListener("click", function () { C.toggleGrimoire(); });

    // initial states
    if (window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches) C.setReduce(true);
    C.setMuted(window.EMAudio ? window.EMAudio.isMuted() : true);
    C.setLock(false);
    const m = /[#&]s=(\d+)/.exec(location.hash || "");
    if (m) { C.dom.seed.value = m[1]; C.setLock(true); }

    C.bindKeys();
    C.bindTabKeys();
    C.selectTab("random");                 // initialise aria-selected + roving tabindex
    C.syncGrimAria();                      // #grim aria-expanded truth at boot (drawer boots closed <1024)
    requestAnimationFrame(function () { C.moveArc(); });
    window.addEventListener("resize", function () { C.moveArc(); C.syncGrimAria(); });
    document.addEventListener("pointerdown", function once() {
      if (window.EMAudio) window.EMAudio.unlock();
      document.removeEventListener("pointerdown", once);
    });

    // fade splash
    const sp = byId("splash");
    if (sp) setTimeout(function () { sp.classList.add("gone"); setTimeout(function () { sp.remove(); }, 700); }, 220);

    window.__EM = { ds: ds, C: C };   // debug handle
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
  else setTimeout(boot, 0);
})();
