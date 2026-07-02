/* tooltip.js — observatory-chip tooltips (E5 float tier). One singleton .tip
   driven by delegated listeners; any element with [data-tip] gets one.
   Data contract:
     data-tip       name line (required)
     data-tip-sub   italic sub line (optional)
     data-tip-kbd   shortcut chip; the word "Mod" renders as ⌘ (Apple) / Ctrl
     data-tip-live  marks state-swapping controls eligible for the 1100 ms
                    post-touch confirmation tip (see §2.13 of the design)
   Behavior: 120 ms cold show, instant within a 300 ms warm window; instant on
   :focus-visible focus (INPUT triggers are hover-only so #seed never fights
   typing); hides on pointerout/focusout/Escape/resize/scroll. pointer-events:
   none by design (documented WCAG 1.4.13 tradeoff — see DESIGN.md a11y notes). */
(function () {
  "use strict";
  const UI = (window.EMUI = window.EMUI || {});

  const IS_APPLE = /Mac|iPhone|iPad/.test(navigator.platform || "");
  let tip = null, nameEl = null, kbdEl = null, subEl = null;
  let trigger = null;              // element the tip is anchored to
  let showT = 0, hideT = 0;        // timers
  let lastHide = 0;                // for the warm window
  let lastPointerType = "";        // pointerdown pointerType (touch detection)

  function build() {
    if (tip) return;
    nameEl = UI.el("span", { class: "tip-name" });
    kbdEl = UI.el("span", { class: "tip-kbd" });
    subEl = UI.el("div", { class: "tip-sub" });
    tip = UI.el("div", { class: "tip", id: "tip", role: "tooltip", "aria-hidden": "true" },
      [UI.el("div", { class: "tip-head" }, [nameEl, kbdEl]), subEl]);
    document.body.append(tip);
  }

  function kbdText(raw) {
    return raw.replace(/\bMod\b/g, IS_APPLE ? "⌘" : "Ctrl");
  }

  function render() {
    if (!trigger) return;
    nameEl.textContent = trigger.dataset.tip || "";
    const kbd = trigger.dataset.tipKbd;
    kbdEl.textContent = kbd ? kbdText(kbd) : "";
    kbdEl.hidden = !kbd;
    const sub = trigger.dataset.tipSub;
    subEl.textContent = sub || "";
    subEl.hidden = !sub;
    let lit = false;
    try { lit = trigger.matches(".active,.on"); } catch (e) {}
    tip.classList.toggle("lit", lit);
  }

  function place() {
    if (!trigger) return;
    tip.classList.remove("above");
    tip.style.left = "0px"; tip.style.top = "0px";      // reset before measuring
    const r = trigger.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x = r.left + r.width / 2 - tw / 2;
    x = Math.max(8, Math.min(vw - tw - 8, x));          // 8px gutters
    let y = r.bottom + 8;
    if (y + th > vh - 8) { y = r.top - th - 8; tip.classList.add("above"); }
    tip.style.left = Math.round(x) + "px";
    tip.style.top = Math.round(y) + "px";
    // caret tracks the trigger's center within the (possibly clamped) tip
    const cx = Math.max(10, Math.min(tw - 10, r.left + r.width / 2 - x));
    tip.style.setProperty("--tip-cx", Math.round(cx) + "px");
  }

  function reallyShow(el) {
    build();
    // Re-anchor cleanup: a handoff that skips hide() (focus tip -> hover tip,
    // rapid touch confirmations) must not leave a stale aria-describedby behind.
    if (trigger && trigger !== el) {
      try { trigger.removeAttribute("aria-describedby"); } catch (e) {}
    }
    trigger = el;
    render();
    tip.classList.add("show");
    tip.setAttribute("aria-hidden", "false");
    try { el.setAttribute("aria-describedby", "tip"); } catch (e) {}
    place();
  }

  function show(el, instant) {
    clearTimeout(showT); clearTimeout(hideT); hideT = 0;
    const warm = performance.now() - lastHide < 300;
    if (instant || warm || (tip && tip.classList.contains("show"))) reallyShow(el);
    else showT = setTimeout(function () { reallyShow(el); }, 120);
  }

  function hide() {
    clearTimeout(showT); showT = 0;
    clearTimeout(hideT); hideT = 0;
    if (!tip || !tip.classList.contains("show")) { trigger = null; return; }
    tip.classList.remove("show");
    tip.setAttribute("aria-hidden", "true");
    if (trigger) { try { trigger.removeAttribute("aria-describedby"); } catch (e) {} }
    trigger = null;
    lastHide = performance.now();
  }

  /* Re-render + re-place if the current trigger is still in the DOM — setters
     call this so hover copy flips live as state changes under the pointer. */
  UI.refreshTip = function () {
    if (!trigger || !tip || !tip.classList.contains("show")) return;
    if (!document.contains(trigger)) { hide(); return; }
    render(); place();
  };

  UI.initTooltips = function () {
    build();

    document.addEventListener("pointerdown", function (e) {
      lastPointerType = e.pointerType || "";
    }, true);

    document.addEventListener("pointerover", function (e) {
      if (e.pointerType === "touch") return;            // no hover tips on touch
      const el = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!el) return;
      if (trigger === el && tip.classList.contains("show")) return;
      show(el, false);
    });
    document.addEventListener("pointerout", function (e) {
      if (!trigger && !showT) return;
      const el = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!el) return;
      const to = e.relatedTarget;
      if (to && el.contains(to)) return;                // still inside the trigger
      if (trigger && el !== trigger) return;            // a non-owning trigger must not dismiss a focus-owned tip
      hide();
    });

    document.addEventListener("focusin", function (e) {
      const el = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (!el || el.tagName === "INPUT") return;        // inputs are hover-only
      let fv = true;
      try { fv = el.matches(":focus-visible"); } catch (err) {}
      if (fv) show(el, true);
    });
    document.addEventListener("focusout", function (e) {
      const el = e.target && e.target.closest ? e.target.closest("[data-tip]") : null;
      if (el && trigger === el) hide();
    });

    // Post-touch state confirmation on live (state-swapping) controls; the
    // button's own click handler has already updated dataset by bubble time.
    document.addEventListener("click", function (e) {
      if (lastPointerType !== "touch") return;
      const el = e.target && e.target.closest ? e.target.closest("[data-tip-live]") : null;
      if (!el) return;
      reallyShow(el);
      clearTimeout(hideT);
      hideT = setTimeout(hide, 1100);
    });

    // Dismissals. Escape is capture-phase but never stops propagation, so the
    // modal Esc handler (widgets.js) still closes an open dialog after the tip.
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
    }, true);
    window.addEventListener("resize", hide);
    document.addEventListener("scroll", function () {
      if (tip && tip.classList.contains("show")) hide();
    }, { capture: true, passive: true });
  };
})();
