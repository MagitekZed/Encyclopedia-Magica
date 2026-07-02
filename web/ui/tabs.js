/* tabs.js — the three roll tabs: Random Item, Single Table, Artifacts. */
(function () {
  "use strict";
  const UI = (window.EMUI = window.EMUI || {});
  const el = UI.el;

  function inner(mount) { const d = el("div", { class: "body-inner" }); mount.append(d); return d; }

  function makeSpinner(value, min, max, onchange) {
    const s = el("span", { class: "spinner" });
    const dn = el("button", { class: "step", text: "▾", type: "button" });
    const inp = el("input", { type: "text", inputmode: "numeric", value: String(value) });
    const up = el("button", { class: "step", text: "▴", type: "button" });
    s.append(dn, inp, up);
    const get = () => { const v = parseInt(inp.value, 10); return Number.isFinite(v) ? v : NaN; };
    const set = (v) => { inp.value = String(v); onchange && onchange(); };
    const clamp = (v) => Math.max(min, Math.min(max == null ? 1e9 : max, v));
    up.onclick = () => set(clamp((get() || min) + 1));
    dn.onclick = () => set(clamp((get() || min) - 1));
    inp.addEventListener("input", () => { inp.value = inp.value.replace(/[^0-9]/g, ""); onchange && onchange(); });
    inp.addEventListener("blur", () => { let v = get(); if (!Number.isFinite(v) || v < min) set(min); else if (max != null && v > max) set(max); });
    return { el: s, get: get, set: (v) => { inp.value = String(v); }, node: s, invalid: (b) => s.classList.toggle("invalid", b) };
  }

  // ---------------------------------------------------------------- Random
  UI.buildRandom = function (mount, ctrl) {
    const box = inner(mount);
    const bar = el("div", { class: "controls" });
    const roll = el("button", { class: "btn btn-primary btn-lg" });
    roll.append(el("span", { class: "reticle", text: "✦" }), "Roll Random Magic Item");
    roll.addEventListener("click", () => rollDefault());
    const spacer = el("span", { class: "sep" });
    const hoardWrap = el("div", { class: "controls", style: "margin:0" });
    const kSpin = makeSpinner(12, 1, 60);
    const hoardBtn = el("button", { class: "btn btn-ghost", text: "Roll Hoard" });
    hoardBtn.addEventListener("click", () => rollHoard());
    hoardWrap.append(el("label", { class: "field", text: "Treasure Hoard" }), kSpin.el, hoardBtn);
    bar.append(roll, spacer, hoardWrap);
    box.append(bar);
    const view = UI.ResultView(box, ctrl);

    function rollDefault() { ctrl.perform(() => ctrl.engine.rollRandomItem(), view); }
    function rollHoard() {
      const k = kSpin.get();
      if (!Number.isFinite(k) || k < 1) { ctrl.flash("Hoard size must be ≥ 1."); return; }
      ctrl.perform(() => ctrl.engine.rollHoard(k), view);
    }
    return { view: view, rollCapable: true, rollDefault: rollDefault };
  };

  // ---------------------------------------------------------------- Single
  function singleOptions(ds) {
    const nm = {}; ds.masterRows.forEach((m) => nm[m.target] = m.name);
    const groups = [];
    const items = [];
    "ABCDEFGHIJKLMNOPQ".split("").forEach((L) => { if (ds.itemsByTable[L]) items.push([L + " — " + (nm[L] || L), L, 1000]); });
    items.push(["T — Artifacts", "T", 1000]);
    groups.push(["Item Tables", items]);
    groups.push(["Full Assemblies", [["Full Armor (R): type + bonus (or Special)", "R", 1000], ["Full Weapon (S): type + bonus (or Special)", "S", 1000]]]);
    groups.push(["Armor / Weapon Parts", [
      ["R1 — Armor type", "R1", 1000], ["R2 — Armor bonus", "R2", 20], ["R3 — Armor items (list)", "R3", 1000],
      ["S1 — Weapon type", "S1", 1000], ["S2 — Weapon bonus", "S2", 20], ["S3 — Weapon items (list)", "S3", 1000]]]);
    groups.push(["Artifact Powers", Object.keys(ds.powerByNum).sort().map((n) => [n + " — " + ds.powerByNum[n].category, n, ds.powerByNum[n].die])]);
    return groups;
  }

  UI.buildSingle = function (mount, ctrl, ds) {
    const box = inner(mount);
    const bar = el("div", { class: "controls" });
    const sel = el("select", { class: "select", "aria-label": "Choose a table", style: "flex:1 1 240px;min-width:0" });
    const dieMap = {};
    singleOptions(ds).forEach(([g, opts]) => {
      const og = document.createElement("optgroup"); og.label = g;
      opts.forEach(([label, key, die]) => { const o = el("option", { value: key, text: label }); dieMap[key] = die; og.append(o); });
      sel.append(og);
    });
    const badge = UI.dieBadge(1000);
    const roll = el("button", { class: "btn btn-primary", html: "✦ Roll" });
    sel.addEventListener("change", updateBadge);
    roll.addEventListener("click", () => rollDefault());
    bar.append(el("label", { class: "field", text: "Table" }), sel, badge, roll);
    box.append(bar);
    const view = UI.ResultView(box, ctrl);

    function updateBadge() {
      const die = dieMap[sel.value] || 1000;
      badge.setAttribute("data-die", String(die));
      badge.querySelector(".lbl").textContent = "d" + die;
      badge.classList.remove("pulse"); void badge.offsetWidth; badge.classList.add("pulse");
    }
    function rollDefault() { const key = sel.value; ctrl.perform(() => ctrl.engine.rollNamed(key), view); }
    function selectKey(key) { sel.value = key; updateBadge(); }
    updateBadge();
    return { view: view, rollCapable: true, rollDefault: rollDefault, selectKey: selectKey };
  };

  // ---------------------------------------------------------------- Artifacts
  UI.buildArtifacts = function (mount, ctrl, ds) {
    const box = inner(mount);
    const nums = Object.keys(ds.powerByNum).sort();

    // single power
    const p = el("div", { class: "panel glass", style: "margin-bottom:14px" });
    p.append(el("h2", { class: "cinzel", style: "font-size:16px;color:var(--gold);margin:0 0 10px", text: "Single Power" }));
    const prow = el("div", { class: "controls", style: "margin:0" });
    const psel = el("select", { class: "select" });
    psel.append(el("option", { value: "", text: "🎲 Random table" }));
    nums.forEach((n) => psel.append(el("option", { value: n, text: n + " — " + ds.powerByNum[n].category })));
    const pbtn = el("button", { class: "btn btn-primary", html: "✦ Roll Power" });
    pbtn.addEventListener("click", () => { const num = psel.value || null; ctrl.perform(() => ctrl.engine.rollArtifactPower(num), view); });
    prow.append(el("label", { class: "field", text: "Power table" }), psel, pbtn);
    p.append(prow);

    // generate
    const g = el("div", { class: "panel glass" });
    g.append(el("h2", { class: "cinzel", style: "font-size:16px;color:var(--gold);margin:0 0 10px", text: "Generate Artifact" }));
    const grow = el("div", { class: "controls", style: "margin:0" });
    const note = el("span", { class: "note-inline" });
    const nSpin = makeSpinner(4, 1, 99, () => { updateNote(); if (mode() === "choose") rebuild(); });
    const modeR = el("label", { style: "color:var(--mist)" }, [radio("gmode", "random", true), " Random tables "]);
    const modeC = el("label", { style: "color:var(--mist)" }, [radio("gmode", "choose", false), " Choose tables "]);
    const randAll = el("button", { class: "btn btn-ghost", text: "Randomize all" });
    const preset = el("button", { class: "btn btn-ghost", text: "Major/Minor mix" });
    const genBtn = el("button", { class: "btn btn-primary", html: "✦ Generate" });
    grow.append(el("label", { class: "field", text: "Powers (N)" }), nSpin.el, modeR, modeC, randAll, preset, el("span", { class: "sep" }), genBtn);
    const excl = el("label", { style: "color:var(--mist);display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:13px" });
    const exclCb = el("input", { type: "checkbox" });
    exclCb.addEventListener("change", () => { ctrl.engine.pool = exclCb.checked ? nums.filter((n) => n !== "1-00" && n !== "1-24") : null; });
    excl.append(exclCb, el("span", { text: "Exclude meta tables (1-00, 1-24) from random picks" }));
    const slots = el("div", { class: "slots hidden" });
    preset.addEventListener("click", () => {
      nSpin.set(4);
      const cr = modeC.querySelector("input"); cr.checked = true;
      onMode();
      if (slotSelects[0]) slotSelects[0].value = "1-15";              // Major Powers
      for (let i = 1; i < 4 && i < slotSelects.length; i++) slotSelects[i].value = "1-16"; // Minor Powers
      ctrl.flash("Preset: 1 Major (1-15) + 3 Minor (1-16). Generate to roll.");
    });
    g.append(grow, excl, note, slots);

    box.append(p, g);
    const view = UI.ResultView(box, ctrl);

    function radio(name, val, checked) { const r = el("input", { type: "radio", name: name, value: val }); if (checked) r.checked = true; r.addEventListener("change", onMode); return r; }
    function mode() { return g.querySelector('input[name="gmode"]:checked').value; }
    let slotSelects = [];
    function onMode() { if (mode() === "choose") { rebuild(); slots.classList.remove("hidden"); } else slots.classList.add("hidden"); }
    randAll.addEventListener("click", () => slotSelects.forEach((s) => s.value = ""));
    genBtn.addEventListener("click", generate);
    function updateNote() { const n = nSpin.get(); note.textContent = (Number.isFinite(n) && n > window.EM.MAX_POWERS_SOFT) ? ("Large artifact (N=" + n + " > " + window.EM.MAX_POWERS_SOFT + ").") : ""; }

    function rebuild() {
      const n = nSpin.get(); if (!Number.isFinite(n) || n < 1) return;
      const prev = slotSelects.map((s) => s.value);
      slots.innerHTML = ""; slotSelects = [];
      const visible = Math.min(n, 24);
      for (let i = 0; i < visible; i++) {
        const s = el("select", { class: "select" });
        s.append(el("option", { value: "", text: "🎲 Random" }));
        nums.forEach((num) => s.append(el("option", { value: num, text: num })));
        if (i < prev.length) s.value = prev[i];
        const rnd = el("button", { class: "rnd", type: "button", "data-tip": "Randomize this slot", "aria-label": "Randomize power " + (i + 1), text: "🎲" });
        rnd.addEventListener("click", () => { s.value = ""; });
        const slot = el("div", { class: "slot" }, [el("span", { class: "n", text: "Power " + (i + 1) }), s, rnd]);
        slots.append(slot); slotSelects.push(s);
      }
      if (n > visible) slots.append(el("div", { class: "n", style: "grid-column:1/-1", text: "(+" + (n - visible) + " more roll random)" }));
    }
    function tablesArg(n) {
      if (mode() !== "choose") return null;
      const out = []; for (let i = 0; i < n; i++) out.push(i < slotSelects.length ? (slotSelects[i].value || null) : null); return out;
    }
    function generate() {
      const n = nSpin.get();
      if (!Number.isFinite(n) || n < 1) { nSpin.invalid(true); ctrl.flash("N must be a whole number ≥ 1."); return; }
      nSpin.invalid(false);
      const tables = tablesArg(n);
      const res = ctrl.perform(() => ctrl.engine.generateArtifact(n, tables), view);
      if (res && res.root.note) ctrl.flash(res.root.note);
    }
    updateNote();
    return { view: view, rollCapable: true, rollDefault: () => { const num = psel.value || null; ctrl.perform(() => ctrl.engine.rollArtifactPower(num), view); } };
  };
})();
