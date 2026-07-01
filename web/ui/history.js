/* history.js — the Grimoire: persisted, pinnable roll log (localStorage). */
(function () {
  "use strict";
  const UI = (window.EMUI = window.EMUI || {});
  const el = UI.el;
  const KEY = "em_grimoire";
  const CAP = 200;

  UI.Grimoire = function (mount, ctrl) {
    let entries = load();
    let seq = entries.reduce((m, e) => Math.max(m, e.n || 0), 0);

    mount.innerHTML = "";
    const h2 = el("h2", {}, ["✦ Grimoire"]);
    const gClose = el("button", { class: "grim-close", type: "button", "aria-label": "Close grimoire", text: "✕" });
    gClose.addEventListener("click", () => ctrl.toggleGrimoire());
    h2.append(gClose);
    mount.append(h2);
    const list = el("div", { class: "grim-list" });
    const actions = el("div", { class: "grim-actions" });
    const bPin = el("button", { class: "btn btn-ghost", text: "Pin" });
    const bExport = el("button", { class: "btn btn-ghost", text: "Export ▾" });
    const bClear = el("button", { class: "btn btn-ghost", text: "Clear" });
    actions.append(bPin, bExport, bClear);
    mount.append(list, actions);
    let selected = null;
    bPin.addEventListener("click", () => togglePin(selected));
    bClear.addEventListener("click", () => clearAll());
    bExport.addEventListener("click", () => exportAll());

    function load() {
      try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch (e) { /* private mode: in-memory only */ }
    }
    function enforceCap() {
      const live = entries.filter((e) => !e.pinned);
      if (live.length > CAP) {
        let drop = live.length - CAP;
        entries = entries.filter((e) => { if (!e.pinned && drop > 0) { drop--; return false; } return true; });
      }
    }

    function add(result, seed) {
      seq++;
      entries.push({
        id: "g" + seq, n: seq, headline: result.headline, kind: result.kind,
        seed: seed == null ? null : seed, ts: Date.now(), pinned: false, root: result.root,
      });
      enforceCap(); save(); render();
    }

    function togglePin(id) {
      if (!id) { ctrl.flash("Select a roll to pin first."); return; }
      const e = entries.find((x) => x.id === id);
      if (e) { e.pinned = !e.pinned; save(); render(); if (window.EMAudio) window.EMAudio.play("pin"); }
    }
    function clearAll() { entries = entries.filter((e) => e.pinned); save(); render(); }

    function render() {
      list.innerHTML = "";
      if (!entries.length) {
        list.append(el("div", { class: "grim-empty", text: "The log is empty — cast a roll to inscribe it." }));
        return;
      }
      const pinned = entries.filter((e) => e.pinned).reverse();
      const live = entries.filter((e) => !e.pinned).reverse();
      pinned.concat(live).forEach(addRow);
    }
    function addRow(e) {
      const row = el("div", { class: "grim-entry" + (e.pinned ? " pinned" : "") });
      row.append(el("span", { class: "sig" }, [UI.sigil(e.seed, 20)]));
      const head = el("div", { class: "g-head", text: (e.pinned ? "📌 " : "") + (e.label || e.headline) });
      row.append(head, el("span", { class: "g-meta", text: "#" + e.n }));
      row.addEventListener("click", () => { selected = e.id; highlight(row); openPopup(e); });
      list.append(row);
    }
    function highlight(row) {
      list.querySelectorAll(".grim-entry").forEach((r) => r.style.outline = "");
      row.style.outline = "1px solid var(--astral-blue)";
    }

    function openPopup(e) {
      const dlg = el("div", { class: "dialog glass" });
      dlg.append(el("h3", { text: e.label || e.headline }));
      if (e.label) dlg.append(el("div", { text: e.headline, style: "color:var(--mist);font-style:italic;margin:-6px 0 8px" }));
      const meta = e.kind + " · seed " + (e.seed == null ? "—" : e.seed) + " · #" + e.n;
      dlg.append(el("div", { class: "mono", text: meta, style: "color:var(--mist);margin-bottom:10px" }));
      dlg.append(UI.renderTrace(e.root, {}).el);
      const bar = el("div", { style: "display:flex;gap:8px;margin-top:14px;flex-wrap:wrap" });
      const cp = el("button", { class: "btn btn-ghost", text: "Copy" });
      cp.addEventListener("click", () => ctrl.copyText(window.EM.resultToText(e.headline, e.root, e.seed), "Copied."));
      const pn = el("button", { class: "btn btn-ghost", text: e.pinned ? "Unpin" : "Pin" });
      const lb = el("button", { class: "btn btn-ghost", text: "Label…" });
      lb.addEventListener("click", () => {
        const v = window.prompt("Label this roll (e.g. \"Boss's Sword\"):", e.label || e.headline);
        if (v != null) { e.label = v.trim() || null; if (v.trim() && !e.pinned) e.pinned = true; save(); render(); m.close(); }
      });
      bar.append(cp, lb, pn);
      dlg.append(bar);
      const m = UI.openModal(dlg, { label: e.headline });
      pn.addEventListener("click", () => { togglePin(e.id); m.close(); });
    }

    function exportAll() {
      if (!entries.length) { ctrl.flash("Nothing to export."); return; }
      const dlg = el("div", { class: "dialog glass", style: "width:min(380px,90vw)" });
      dlg.append(el("h3", { text: "Export Grimoire" }));
      dlg.append(el("div", { text: entries.length + " entries", style: "color:var(--mist);margin-bottom:10px" }));
      const bar = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap" });
      [["Text (.txt)", "txt"], ["Markdown (.md)", "md"], ["JSON (.json)", "json"]].forEach((fm) => {
        const b = el("button", { class: "btn btn-ghost", text: fm[0] });
        b.addEventListener("click", () => { m.close(); doExport(fm[1]); });
        bar.append(b);
      });
      dlg.append(bar);
      const m = UI.openModal(dlg, { label: "Export grimoire" });
    }
    function doExport(fmt) {
      if (fmt === "json") { ctrl.download("grimoire.json", JSON.stringify(entries, null, 2), "application/json"); return; }
      const md = fmt === "md";
      const blocks = entries.map((e) => {
        const head = (e.pinned ? "📌 " : "") + (e.label ? e.label + " — " : "") + e.headline;
        const body = window.EM.traceLines(e.root).join("\n");
        const seed = e.seed == null ? "" : "\nseed " + e.seed;
        return md ? ("### " + head + "\n\n```\n" + body + seed + "\n```") : (head + "\n" + body + seed);
      });
      ctrl.download(md ? "grimoire.md" : "grimoire.txt", blocks.join("\n\n"), md ? "text/markdown" : "text/plain");
    }

    render();
    return { add: add };
  };
})();
