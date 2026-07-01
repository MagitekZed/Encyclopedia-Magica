/* selftest.js — data + engine self-test, mirroring the 44 Python unit tests.
   Used by BOTH the in-app Diagnostics panel and the Node CI runner (tests/run.js). */
(function () {
  "use strict";
  const EM = (globalThis.EM = globalThis.EM || {});

  const COMBINE = new Set(["reroll", "enhancement"]);
  const CAP = new Set(["cap"]);
  const ENH = new Set(["enhancement"]);

  function firstReroll(ds, table) {
    for (const it of ds.itemsByTable[table]) if (it.reroll && it.name !== "Enchanted Enhancements") return it;
    throw new Error("no reroll item in " + table);
  }
  function firstPlain(ds, table) {
    for (const it of ds.itemsByTable[table]) if (!it.reroll) return it;
    throw new Error("no plain item in " + table);
  }
  function eeItem(ds, table) {
    for (const it of ds.itemsByTable[table]) if (it.name === "Enchanted Enhancements") return it;
    throw new Error("no EE item in " + table);
  }
  function rerollEnhRoll(ds) {
    for (const r of ds.enhancement) if (r.reroll) return r.roll_low;
    throw new Error("no reroll enh row");
  }
  function mechRoll(ds, key, substr) {
    for (const r of ds.mech[key]) if (r.name.toLowerCase().indexOf(substr.toLowerCase()) !== -1) return r.roll_low;
    throw new Error("no " + key + " row ~ " + substr);
  }
  function catchallRoll(ds, key) {
    for (const r of ds.mech[key]) if (r.is_r3_catchall) return r.roll_low;
    throw new Error("no catch-all in " + key);
  }

  EM.runSelfTest = function (ds) {
    const checks = [];
    const eng = (vals) => new EM.RollEngine(ds, new EM.FixedRoller(vals));
    function ok(name, cond, detail) { checks.push({ name: name, pass: !!cond, detail: detail || "" }); }
    function eq(name, a, b) { checks.push({ name: name, pass: JSON.stringify(a) === JSON.stringify(b), detail: `${JSON.stringify(a)} == ${JSON.stringify(b)}` }); }
    function throws(name, fn) { let t = false; try { fn(); } catch (e) { t = true; } checks.push({ name: name, pass: t, detail: t ? "raised" : "did NOT raise" }); }

    try {
      // ---- ranges ----
      eq("parseRange 953-000 @1000", EM.parseRange("953-000", 1000), [953, 1000]);
      eq("parseRange 98-100 @1000 (S1)", EM.parseRange("98-100", 1000), [98, 100]);
      eq("parseRange 91-00 @100", EM.parseRange("91-00", 100), [91, 100]);
      eq("parseRange 78-00 @100", EM.parseRange("78-00", 100), [78, 100]);
      eq("parseRange 000 @1000 max", EM.parseRange("000", 1000), [1000, 1000]);
      eq("parseRange 0 @20 max", EM.parseRange("0", 20), [20, 20]);
      eq("parseRange 1 @20 bare", EM.parseRange("1", 20), [1, 1]);
      eq("die never inferred (91-00 @1000)", EM.parseRange("91-00", 1000), [91, 1000]);
      ok("contains boundaries", EM.contains(78, 100, 88) && !EM.contains(78, 100, 77));

      // ---- format ----
      eq("fmtRoll d1000 1000->000", EM.fmtRoll(1000, 1000), "000");
      eq("fmtRoll d1000 5->005", EM.fmtRoll(1000, 5), "005");
      eq("fmtRoll d100 100->00", EM.fmtRoll(100, 100), "00");
      eq("pageText int", EM.pageText({ page: 341, page_status: "filled" }), "p.341");
      eq("pageText list (multi-page)", EM.pageText({ page: [446, 824], page_status: "filled" }), "pp.446, 824");
      eq("pageText not_in_index", EM.pageText({ page: null, page_status: "not_in_index" }), "not in index");

      // ---- loader / dataset ----
      eq("item count 5709", ds.itemCount, 5709);
      const tables = Object.keys(ds.itemsByTable).sort().join(",");
      eq("table set", tables, "A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R3,S3,T");
      let rr = 0, ee = 0, nii = 0;
      for (const t of Object.keys(ds.itemsByTable)) for (const it of ds.itemsByTable[t]) {
        if (it.reroll) rr++; if (it.name === "Enchanted Enhancements") ee++;
        if (it.page_status !== "filled") nii++;
      }
      eq("reroll count 75", rr, 75);
      eq("EE-named count 19", ee, 19);
      eq("not_in_index count 10", nii, 10);
      const q = ds.mech.S1.find((r) => r.name.indexOf("Quarrel") === 0);
      eq("S1 die pinned 1000 (Quarrel 98-100)", [q.roll_low, q.roll_high], [98, 100]);
      ok("S1 catch-all reaches 1000", ds.mech.S1[ds.mech.S1.length - 1].roll_high === 1000);
      const warns = ds.dataWarnings();
      ok("only warning is 1-16@37", warns.length === 1 && /power 1-16: gap at 37/.test(warns[0]), warns.join(" | "));
      ok("no R1 gap warning", !warns.some((w) => w.indexOf("R1:") === 0));

      // ---- cascade cap ----
      const plainA = firstPlain(ds, "A"), rrA = firstReroll(ds, "A"), eeA = eeItem(ds, "A"), aq = rerollEnhRoll(ds);
      ok("non-reroll item: no children", eng([plainA.roll_low]).rollItemTable("A").root.children.length === 0);
      let r1 = eng(Array(4).fill(rrA.roll_low)).rollItemTable("A").root;
      ok("pure item-reroll = 3 combines + cap", EM.countKinds(r1, COMBINE) === 3 && EM.countKinds(r1, CAP) === 1);
      let r2 = eng([eeA.roll_low, aq, aq, aq]).rollItemTable("A").root;
      ok("pure EE = 3 enh + cap", EM.countKinds(r2, ENH) === 3 && EM.countKinds(r2, CAP) === 1);
      let r3 = eng([rrA.roll_low, eeA.roll_low, aq, aq]).rollItemTable("A").root;
      ok("mixed chain = 3 combines (1 reroll + 2 enh) + cap",
        EM.countKinds(r3, COMBINE) === 3 && EM.countKinds(r3, new Set(["reroll"])) === 1 &&
        EM.countKinds(r3, ENH) === 2 && EM.countKinds(r3, CAP) === 1);
      const rr3 = firstReroll(ds, "R3");
      const rSpecial = catchallRoll(ds, "R1");                 // R3 only rolls when R1 = Special
      const deep = eng([rSpecial, rr3.roll_low, rr3.roll_low]).assembleArmor(2);
      ok("R3-in-armor depth2 shares budget = 1 combine + cap", EM.countKinds(deep, COMBINE) === 1 && EM.countKinds(deep, CAP) === 1);
      const shallow = eng([rSpecial].concat(Array(4).fill(rr3.roll_low))).assembleArmor(0);
      ok("R3-in-armor depth0 = 3 combines + cap", EM.countKinds(shallow, COMBINE) === 3 && EM.countKinds(shallow, CAP) === 1);

      // ---- R/S procedure: generic (type+bonus) vs Special (roll R3/S3) ----
      const sword = mechRoll(ds, "S1", "Sword"), axe = mechRoll(ds, "S1", "Axe"), plus2 = mechRoll(ds, "S2", "+2");
      const gw = eng([sword, plus2]).rollWeapon();             // only 2 rolls — no S3
      ok("generic weapon = type+bonus, no S3", gw.root.children.map((c) => c.table).join() === "S1,S2" && gw.headline === "+2 Sword", gw.headline);
      ok("S2 Wpn Adj for non-swords (Axe +1 vs Sword +2)", eng([axe, plus2]).rollWeapon().headline === "+1 Axe");
      const minus1 = mechRoll(ds, "S2", "-1");
      ok("cursed weapon -1 Sword", eng([sword, minus1]).rollWeapon().headline === "-1 Sword");
      const armorType = mechRoll(ds, "R1", "Armor"), acP2 = mechRoll(ds, "R2", "AC Adj +2"), acM1 = mechRoll(ds, "R2", "AC Adj -1");
      ok("generic armor +2 Armor", eng([armorType, acP2]).rollArmor().headline === "+2 Armor");
      ok("cursed armor -1 Armor", eng([armorType, acM1]).rollArmor().headline === "-1 Armor");
      const sItem = firstPlain(ds, "S3");
      const sp = eng([catchallRoll(ds, "S1"), sItem.roll_low]).rollWeapon();
      ok("Special weapon -> S3 item", sp.root.children.map((c) => c.table).join() === "S1,S3" && sp.headline === sItem.name && /\(Special\)$/.test(sp.root.label), sp.headline);
      const rItem = firstPlain(ds, "R3");
      const ap = eng([rSpecial, rItem.roll_low]).rollArmor();
      ok("Special armor -> R3 item", ap.root.children.map((c) => c.table).join() === "R1,R3" && ap.headline === rItem.name);
      const e0 = eng([]);
      eq("bonusPlus S2 -1", e0.bonusPlus("S2", "-1"), "-1");
      eq("bonusPlus R2 AC Adj +2", e0.bonusPlus("R2", "AC Adj +2 / XP Value +1,000"), "+2");
      eq("bonusPlus R2 fallback", e0.bonusPlus("R2", "totally unexpected"), "totally unexpected");

      // ---- master ----
      const rm = eng([78, sword, plus2]).rollRandomItem();
      ok("master 78 -> weapon assembly", rm.root.children[0].table === "weapon" && rm.root.label === "Weapons");
      ok("master low -> item table", eng([1, plainA.roll_low]).rollRandomItem().root.children[0].table === "A");

      // ---- artifacts ----
      ok("power 1-16 @37 is a gap", eng([37]).rollArtifactPower("1-16").root.kind === "gap");
      ok("generate re-rolls a gap slot", eng([37, 38]).generateArtifact(1, ["1-16"]).root.children[0].kind === "roll");
      const dup = eng([3, 4]).generateArtifact(2, ["1-00", "1-00"]).root;
      ok("duplicate tables allowed", dup.children[0].table === "power:1-00" && dup.children[1].table === "power:1-00");
      throws("generateArtifact(0) throws", () => eng([]).generateArtifact(0));
      throws("generateArtifact len mismatch throws", () => eng([1, 1]).generateArtifact(3, ["1-00", "1-00"]));
    } catch (err) {
      checks.push({ name: "EXCEPTION during self-test", pass: false, detail: String(err && err.stack || err) });
    }

    const passed = checks.filter((c) => c.pass).length;
    const failed = checks.length - passed;
    return { ok: failed === 0, passed: passed, failed: failed, checks: checks };
  };
})();
