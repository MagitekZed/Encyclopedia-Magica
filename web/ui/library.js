/* library.js — "The Star Catalog": virtualized 5,709-row browser. */
(function () {
  "use strict";
  const UI = (window.EMUI = window.EMUI || {});
  const el = UI.el;
  const ROW_H = (window.matchMedia && window.matchMedia("(max-width:640px)").matches) ? 44 : 34;
  const OVERSCAN = 8, DEBOUNCE = 150;
  const NAMES = { A: "Magical Liquids", B: "Scrolls", C: "Rings", D: "Rods", E: "Staves", F: "Wands",
    G: "Books", H: "Gems & Jewelry", I: "Clothing", J: "Boots & Gloves", K: "Girdles & Helms",
    L: "Bags & Bottles", M: "Dust & Stones", N: "Household", O: "Instruments", P: "Weird Stuff",
    Q: "Humorous", R3: "Armor items", S3: "Weapon items", T: "Artifacts" };

  UI.Library = function (mount, ctrl, ds) {
    let lens = "All", tokens = [], sortCol = null, sortRev = false, rows = [], debounceT = null;

    mount.innerHTML = "";
    const wrap = el("div", { class: "library" });
    const lenses = el("div", { class: "lib-lenses" });
    const main = el("div", { class: "lib-main" });
    wrap.append(lenses, main); mount.append(wrap);

    // lenses
    const lensDefs = [["All", ds.itemCount]].concat(
      Object.keys(ds.itemsByTable).sort().map((t) => [t, ds.itemsByTable[t].length]));
    lensDefs.forEach(([k, cnt]) => {
      const chip = el("div", { class: "lens" + (k === "All" ? " active" : ""), "data-lens": k });
      if (k !== "All") chip.append(el("span", { class: "chip" }));
      chip.append(el("span", { text: k === "All" ? "All Tables" : k + " · " + (NAMES[k] || k) }),
        el("span", { class: "cnt", text: String(cnt) }));
      chip.addEventListener("click", () => { lens = k; lenses.querySelectorAll(".lens").forEach((c) => c.classList.toggle("active", c === chip)); refilter(); });
      lenses.append(chip);
    });

    // search + table
    const search = el("div", { class: "lib-search" });
    const box = el("div", { class: "box" });
    const input = el("input", { type: "text", placeholder: "Search name, category, page…", "aria-label": "Search library" });
    box.append(el("span", { text: "🔍", style: "color:var(--aurora-teal)" }), input);
    const count = el("div", { class: "lib-count", role: "status", "aria-live": "polite", "aria-atomic": "true" });
    search.append(box, count);

    const table = el("div", { class: "lib-table", role: "grid", "aria-label": "Item catalog" });
    const head = el("div", { class: "lib-head", role: "row" });
    [["table", "Table"], ["roll", "Roll"], ["name", "Name"], ["page", "Page"], ["reroll", "Reroll?"]].forEach(([c, lbl]) => {
      const b = el("button", { text: lbl, role: "columnheader", "aria-sort": "none" });
      if (c === "reroll") b.classList.add("h-rr");
      const arrow = el("span", { class: "arrow", text: "" });
      b.append(arrow);
      b.addEventListener("click", () => sortBy(c));
      b._col = c; b._arrow = arrow; head.append(b);
    });
    const scroll = el("div", { class: "lib-scroll" });
    const viewport = el("div", { class: "lib-viewport" });
    scroll.append(viewport);
    table.append(head, scroll);
    main.append(search, table);

    input.addEventListener("input", () => { clearTimeout(debounceT); debounceT = setTimeout(refilter, DEBOUNCE); });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; refilter(); } });
    scroll.addEventListener("scroll", () => requestAnimationFrame(renderWindow));
    window.addEventListener("resize", () => requestAnimationFrame(renderWindow));

    function sortBy(c) { if (sortCol === c) sortRev = !sortRev; else { sortCol = c; sortRev = false; } applySort(); updateArrows(); renderWindow(); }
    function updateArrows() {
      head.querySelectorAll("button").forEach((b) => {
        const active = b._col === sortCol;
        b._arrow.textContent = active ? (sortRev ? " ▼" : " ▲") : "";
        b.setAttribute("aria-sort", active ? (sortRev ? "descending" : "ascending") : "none");
      });
    }
    function pageKey(p) { return p == null ? 1e9 : (Array.isArray(p) ? Math.min.apply(null, p) : p); }
    function applySort() {
      if (!sortCol) return;
      const c = sortCol;
      rows.sort((a, b) => {
        let x, y;
        if (c === "table") { x = a.table; y = b.table; if (x === y) return (a.roll_low - b.roll_low) * (sortRev ? -1 : 1); }
        else if (c === "roll") return (a.roll_low - b.roll_low) * (sortRev ? -1 : 1);
        else if (c === "name") { x = a.name.toLowerCase(); y = b.name.toLowerCase(); }
        else if (c === "page") return (pageKey(a.page) - pageKey(b.page)) * (sortRev ? -1 : 1);
        else if (c === "reroll") { x = a.reroll ? 0 : 1; y = b.reroll ? 0 : 1; if (x === y) return (a.roll_low - b.roll_low) * (sortRev ? -1 : 1); }
        return (x < y ? -1 : x > y ? 1 : 0) * (sortRev ? -1 : 1);
      });
    }

    function refilter() {
      tokens = input.value.split(/\s+/).filter(Boolean);
      rows = ds.search(tokens);
      if (lens !== "All") rows = rows.filter((it) => it.table === lens);
      applySort();
      viewport.style.height = (rows.length * ROW_H) + "px";
      scroll.scrollTop = 0;
      const q = input.value.trim();
      count.textContent = (!rows.length && q) ? ('No items match "' + q + '" — clear (Esc)') : (rows.length + " of " + ds.itemCount);
      renderWindow();
    }

    function hl(name) {
      if (!tokens.length) return document.createTextNode(name);
      const frag = document.createElement("span");
      let rest = name, low = name.toLowerCase();
      // highlight first occurrence of each token
      const marks = [];
      tokens.forEach((t) => { const i = low.indexOf(t.toLowerCase()); if (i >= 0) marks.push([i, i + t.length]); });
      if (!marks.length) return document.createTextNode(name);
      marks.sort((a, b) => a[0] - b[0]);
      let pos = 0;
      marks.forEach(([s, e]) => { if (s < pos) return; frag.append(document.createTextNode(name.slice(pos, s)));
        frag.append(el("mark", { text: name.slice(s, e) })); pos = e; });
      frag.append(document.createTextNode(name.slice(pos)));
      return frag;
    }

    function pageStr(it) {
      if (it.page_status !== "filled" || it.page == null) return ["—", true];
      return [Array.isArray(it.page) ? "pp." + it.page.join(",") : "p." + it.page, false];
    }

    function renderWindow() {
      const st = scroll.scrollTop, h = scroll.clientHeight;
      let start = Math.max(0, Math.floor(st / ROW_H) - OVERSCAN);
      let end = Math.min(rows.length, Math.ceil((st + h) / ROW_H) + OVERSCAN);
      viewport.innerHTML = "";
      if (!rows.length) { viewport.append(el("div", { class: "lib-empty", text: input.value.trim() ? "No stars in this quadrant." : "" })); return; }
      for (let i = start; i < end; i++) {
        const it = rows[i];
        const row = el("div", { class: "lib-row" + (it.reroll ? " reroll" : ""), role: "row", tabindex: "0",
          "aria-label": it.table + " " + it.roll_display + ", " + it.name + (it.reroll ? ", reroll" : "") });
        row.style.top = (i * ROW_H) + "px"; row.style.height = ROW_H + "px";
        row.append(el("span", { class: "c-table", role: "gridcell" }, [el("span", { class: "chip" }), it.table]));
        row.append(el("span", { class: "c-roll", role: "gridcell", text: it.roll_display }));
        row.append(el("span", { class: "c-name", role: "gridcell" }, [hl(it.name)]));
        const [ps, none] = pageStr(it);
        row.append(el("span", { class: "c-page" + (none ? " none" : ""), role: "gridcell", text: ps }));
        const rr = el("span", { class: "c-rr", role: "gridcell" });
        if (it.name === "Enchanted Enhancements") rr.append(el("span", { class: "ee", text: "✦" }));
        else if (it.reroll) rr.textContent = "⟳";
        row.append(rr);
        row.addEventListener("click", () => detail(it));
        row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); detail(it); } });
        viewport.append(row);
      }
    }

    function detail(it) {
      const dlg = el("div", { class: "dialog glass", style: "width:min(460px,92vw)" });
      dlg.append(el("h3", { text: it.name }));
      const [ps] = pageStr(it);
      [["Table", it.table + " · " + (NAMES[it.table] || "")], ["Roll (d1000)", it.roll_display],
       ["Category", it.category || "—"], ["Subcategory", it.subcategory || "—"],
       ["Page", it.page_status === "filled" ? ps : "not in index"],
       ["Reroll / combine", it.reroll ? "yes ⟳" : "no"]].forEach(([k, v]) => {
        dlg.append(el("div", { class: "row" }, [el("span", { class: "k", text: k }), el("span", { text: String(v) })]));
      });
      const b = el("button", { class: "btn btn-ghost", style: "margin-top:14px", text: "Roll this table (" + it.table + ") →" });
      dlg.append(b);
      const m = UI.openModal(dlg, { label: it.name + " detail" });
      b.addEventListener("click", () => { m.close(); ctrl.selectTab("single"); ctrl.tabs.single.selectKey(it.table); });
    }

    function focusSearch() { input.focus(); input.select(); }
    function clearSearch() { input.value = ""; refilter(); }

    refilter();
    return { focusSearch: focusSearch, clearSearch: clearSearch };
  };
})();
