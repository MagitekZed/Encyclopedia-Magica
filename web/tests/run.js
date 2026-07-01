/* Node CI runner — loads the exact same modules the browser uses and runs the
   shared self-test (mirrors the 44 Python unit tests). `node web/tests/run.js`. */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

globalThis.window = globalThis;                 // data.js assigns window.EM_DATA
const root = path.resolve(__dirname, "..");
function load(rel) {
  vm.runInThisContext(fs.readFileSync(path.join(root, rel), "utf8"), { filename: rel });
}
["data.js", "js/ranges.js", "js/rng.js", "js/format.js", "js/dataset.js", "js/engine.js", "js/selftest.js"].forEach(load);

const EM = globalThis.EM;
const ds = new EM.Dataset(globalThis.window.EM_DATA);
const res = EM.runSelfTest(ds);
for (const c of res.checks) if (!c.pass) console.log("FAIL: " + c.name + "  ::  " + c.detail);
console.log(`\n${res.passed}/${res.checks.length} checks passed, ${res.failed} failed`);
process.exit(res.ok ? 0 : 1);
