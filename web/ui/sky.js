/*
 * EMSky — "The Living Cosmos" animated starfield for the Astral Observatory.
 * Implements DESIGN.md §4: ~900 pre-rendered stars across 3 depth layers with
 * per-frame twinkle only, ~6 drifting seeded constellations on the deepest
 * layer, damped pointer parallax, and the mandatory performance guardrails.
 *
 * The canvas draws ONLY stars + constellations. The aurora and vignette are
 * separate CSS layers and are intentionally never painted here.
 *
 * Public contract (called by the app):
 *   window.EMSky.init(canvasEl)      begin rendering: rAF loop, resize, parallax
 *   window.EMSky.setReducedMotion(b) true => one static paint; false => animate
 *   window.EMSky.destroy()           stop rAF, remove listeners
 */
(function () {
  "use strict";
  var S = (window.EMSky = window.EMSky || {});

  /* ---- Tunables (from DESIGN.md §4) ---- */
  var STAR_COUNT = 900;                 // total stars across all layers
  var CONSTELLATIONS = 6;               // pre-seeded on the deepest layer
  var SEED = 0x5A17;                    // fixed layout seed => stable across resizes
  var MAX_DPR = 2;                      // cap devicePixelRatio
  // Depth layers: [depth 0..1 for twinkle/drift scaling, parallax strength px].
  var LAYERS = [
    { frac: 0.55, parallax: 4, sizeMin: 0.5, sizeMax: 1.1 }, // far / deepest
    { frac: 0.30, parallax: 9, sizeMin: 0.8, sizeMax: 1.7 }, // mid
    { frac: 0.15, parallax: 16, sizeMin: 1.1, sizeMax: 2.4 } // near (moves most)
  ];
  // Star colors: mostly cool white, a few faint blue + gold tints.
  var COL_WHITE = "234,240,255"; // --star-white  #EAF0FF
  var COL_BLUE = "76,166,255";   // --astral-blue #4CA6FF
  var COL_GOLD = "233,196,106";  // --gold        #E9C46A

  /* ---- State ---- */
  var canvas = null, ctx = null;
  var W = 0, H = 0, dpr = 1;
  var layers = [];                 // { off, stars:[], px, py } prerendered per layer
  var constellations = [];         // { nodes:[{x,y}], edges:[[i,j]], color, dx, dy }
  var rafId = 0, running = false, reducedMotion = false;
  var startTime = 0;
  var pointerTarget = { x: 0, y: 0 }; // normalized -1..1
  var pointerCurrent = { x: 0, y: 0 };
  var pointerDirty = false;
  var parallaxEnabled = true;
  var currentStarCount = STAR_COUNT;
  var throttled = false;              // guard so we only halve once
  var resizeTimer = 0;
  var smoothedDelta = 16.7;           // ms, exponential moving average
  var slowSince = 0;                  // timestamp we first dipped below 45fps

  /* ---- mulberry32 PRNG — deterministic layout (never Math.random for layout) ---- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickColor(rand) {
    var r = rand();
    if (r < 0.08) return COL_BLUE;   // few faint blue
    if (r < 0.14) return COL_GOLD;   // few gold
    return COL_WHITE;                // mostly cool white
  }

  /* ---- Build layout: stars per layer + constellations on the deepest layer ---- */
  function buildLayout() {
    layers = [];
    constellations = [];
    if (W <= 0 || H <= 0) return;
    var rand = mulberry32(SEED);

    for (var li = 0; li < LAYERS.length; li++) {
      var cfg = LAYERS[li];
      var count = Math.round(currentStarCount * cfg.frac);
      var stars = [];
      for (var i = 0; i < count; i++) {
        stars.push({
          x: rand() * W,
          y: rand() * H,
          r: cfg.sizeMin + rand() * (cfg.sizeMax - cfg.sizeMin),
          color: pickColor(rand),
          base: 0.35 + rand() * 0.4,        // base alpha
          amp: 0.12 + rand() * 0.25,        // twinkle amplitude
          freq: 0.2 + rand() * 0.4,         // 0.2–0.6 Hz twinkle
          phase: rand() * Math.PI * 2       // per-star phase offset
        });
      }
      layers.push({ off: null, stars: stars, px: 0, py: 0 });
      prerenderLayer(li);
    }

    // Constellations live on the deepest layer (index 0). Nodes + faint lines.
    for (var c = 0; c < CONSTELLATIONS; c++) {
      var cx = rand() * W, cy = rand() * H;
      var spread = 60 + rand() * 120;
      var n = 4 + Math.floor(rand() * 4); // 4–7 nodes
      var nodes = [];
      for (var k = 0; k < n; k++) {
        nodes.push({
          x: cx + (rand() - 0.5) * 2 * spread,
          y: cy + (rand() - 0.5) * 2 * spread
        });
      }
      // Connect as a simple chain plus one or two extra links => faint geometry.
      var edges = [];
      for (var e = 0; e < n - 1; e++) edges.push([e, e + 1]);
      if (n > 3 && rand() < 0.7) edges.push([0, n - 1]);
      constellations.push({
        nodes: nodes,
        edges: edges,
        color: rand() < 0.5 ? COL_GOLD : COL_BLUE,
        lineAlpha: 0.06 + rand() * 0.04,      // 6–10%
        dx: (rand() - 0.5) * 0.004,           // very slow drift px/ms
        dy: (rand() - 0.5) * 0.004,
        ox: 0, oy: 0                          // accumulated drift offset
      });
    }
  }

  /* ---- Pre-render a layer's stars once into an offscreen canvas ---- */
  function prerenderLayer(li) {
    var layer = layers[li];
    var off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(W * dpr));
    off.height = Math.max(1, Math.round(H * dpr));
    var octx = off.getContext("2d");
    if (!octx) { layer.off = null; return; }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, W, H);
    for (var i = 0; i < layer.stars.length; i++) {
      var s = layer.stars[i];
      octx.beginPath();
      octx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      octx.fillStyle = "rgba(" + s.color + ",1)";
      octx.fill();
    }
    layer.off = off;
  }

  /* ---- Draw one full frame ---- */
  function draw(now) {
    if (!ctx) return;
    var t = (now - startTime) / 1000; // seconds
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    for (var li = 0; li < layers.length; li++) {
      var layer = layers[li];
      var cfg = LAYERS[li];
      var ox = parallaxEnabled ? pointerCurrent.x * cfg.parallax : 0;
      var oy = parallaxEnabled ? pointerCurrent.y * cfg.parallax : 0;

      // Base pre-rendered starfield, translated for parallax (globalAlpha low so
      // the per-star twinkle overlay carries the brightness variation). 5-arg
      // drawImage with explicit CSS-unit size: the offscreen is W*dpr device px,
      // so the 3-arg form rendered it at 2x under the dpr transform on retina.
      if (layer.off) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(layer.off, ox, oy, W, H);
        ctx.globalAlpha = 1;
      }

      // Constellations on the deepest layer, under the twinkle overlay.
      if (li === 0) drawConstellations(now, ox, oy);

      // Per-star twinkle overlay — the ONLY per-star per-frame work.
      var stars = layer.stars;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var tw = s.base + s.amp * Math.sin(t * s.freq * Math.PI * 2 + s.phase);
        if (tw <= 0) continue;
        if (tw > 1) tw = 1;
        ctx.globalAlpha = tw;
        ctx.fillStyle = "rgba(" + s.color + ",1)";
        ctx.beginPath();
        ctx.arc(s.x + ox, s.y + oy, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawConstellations(now, ox, oy) {
    for (var c = 0; c < constellations.length; c++) {
      var con = constellations[c];
      var dx = con.ox + ox, dy = con.oy + oy;
      // Lines
      ctx.strokeStyle = "rgba(" + con.color + "," + con.lineAlpha + ")";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var e = 0; e < con.edges.length; e++) {
        var a = con.nodes[con.edges[e][0]], b = con.nodes[con.edges[e][1]];
        ctx.moveTo(a.x + dx, a.y + dy);
        ctx.lineTo(b.x + dx, b.y + dy);
      }
      ctx.stroke();
      // Nodes (a touch brighter than the lines)
      ctx.fillStyle = "rgba(" + con.color + "," + (con.lineAlpha * 2.2) + ")";
      for (var k = 0; k < con.nodes.length; k++) {
        var nnode = con.nodes[k];
        ctx.beginPath();
        ctx.arc(nnode.x + dx, nnode.y + dy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* ---- Static single paint for reduced motion (base alpha, no twinkle) ---- */
  function drawStatic() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (var li = 0; li < layers.length; li++) {
      var layer = layers[li];
      if (layer.off) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(layer.off, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (li === 0) drawConstellations(0, 0, 0);
      // Stars at base alpha, no twinkle, no parallax.
      var stars = layer.stars;
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = Math.min(1, s.base);
        ctx.fillStyle = "rgba(" + s.color + ",1)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- rAF loop with damped parallax, constellation drift, auto-throttle ---- */
  var lastFrame = 0;
  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    // Frame-delta smoothing for the fps auto-throttle guardrail.
    if (lastFrame) {
      var delta = now - lastFrame;
      smoothedDelta = smoothedDelta * 0.9 + delta * 0.1;
      maybeThrottle(now);
    }
    lastFrame = now;

    // Advance very slow constellation drift.
    for (var c = 0; c < constellations.length; c++) {
      constellations[c].ox += constellations[c].dx * 16;
      constellations[c].oy += constellations[c].dy * 16;
    }

    // Damped parallax: lerp current toward target (nearer layers use larger px).
    if (parallaxEnabled) {
      pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.06;
      pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.06;
    }
    pointerDirty = false;

    try { draw(now); } catch (err) { /* never let a bad frame kill the loop */ }
  }

  function maybeThrottle(now) {
    if (throttled) return;
    if (smoothedDelta > 1000 / 45) { // slower than 45fps
      if (!slowSince) slowSince = now;
      else if (now - slowSince > 1000) { // sustained ~1s
        throttled = true;
        parallaxEnabled = false;
        currentStarCount = Math.max(50, Math.round(STAR_COUNT / 2));
        buildLayout(); // re-layout with halved star count
      }
    } else {
      slowSince = 0;
    }
  }

  /* ---- Sizing / resize (re-layout, re-prerender, debounced) ----
     Measures the CSS rect — NEVER canvas.clientWidth/clientHeight, which echo the
     canvas's OWN width/height attributes when CSS sizing is missing and created a
     geometric-doubling feedback loop (600x300 -> 1200x600 -> 2400x1200 per resize).
     With #sky's height:100lvh the rect is stable across mobile URL-bar transitions,
     so the equal-dims guard short-circuits and no rebuild/re-scatter occurs. */
  function resize() {
    if (!canvas) return;
    var d = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    var r = canvas.getBoundingClientRect();
    var w = Math.round(r.width) || window.innerWidth || 0;
    var h = Math.round(r.height) || window.innerHeight || 0;
    if (w === W && h === H && d === dpr) return;   // no-op guard
    dpr = d; W = w; H = h;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    buildLayout();
    if (reducedMotion || !running) drawStatic();
  }

  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resizeTimer = 0; resize(); }, 150);
  }

  /* ---- Pointer parallax (throttled to rAF via a target + dirty flag) ---- */
  function onPointerMove(e) {
    if (!parallaxEnabled || reducedMotion) return;
    var nx = (e.clientX / (W || 1)) * 2 - 1; // -1..1
    var ny = (e.clientY / (H || 1)) * 2 - 1;
    pointerTarget.x = Math.max(-1, Math.min(1, nx));
    pointerTarget.y = Math.max(-1, Math.min(1, ny));
    pointerDirty = true; // consumed by the rAF loop; no per-event drawing
  }

  /* ---- Visibility: pause on hidden, resume on focus ---- */
  function onVisibility() {
    if (document.hidden) stopLoop();
    else if (!reducedMotion) startLoop();
  }

  function startLoop() {
    if (running || !ctx || reducedMotion) return;
    running = true;
    lastFrame = 0;
    rafId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  /* ---- Public API ---- */
  S.init = function (canvasEl) {
    try {
      if (!canvasEl || !canvasEl.getContext) return;
      canvas = canvasEl;
      ctx = canvas.getContext("2d");
      if (!ctx) return;
      startTime = performance.now ? performance.now() : Date.now();
      resize();
      window.addEventListener("resize", onResize);
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      if (!reducedMotion && !document.hidden) startLoop();
      else drawStatic();
    } catch (err) { /* guard: never throw from init */ }
  };

  S.setReducedMotion = function (bool) {
    reducedMotion = !!bool;
    try {
      if (reducedMotion) {
        stopLoop();
        drawStatic(); // single static paint: base alpha, constellations, no parallax
      } else if (canvas && ctx && !document.hidden) {
        startLoop();
      }
    } catch (err) { /* guard */ }
  };

  S.destroy = function () {
    try {
      stopLoop();
      if (resizeTimer) { clearTimeout(resizeTimer); resizeTimer = 0; }
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
    } catch (err) { /* guard */ }
    canvas = null; ctx = null; layers = []; constellations = [];
  };
})();
