# Encyclopedia Magica — Astral Roller: Final Overhaul Design (rev 2, post-review)
**"The Observatory Refit"** — one design integrating Atmosphere (A), Controls (B), and Hoard (C), with all adversarial-review findings dispositioned in §6.
Repo: `/Users/zach/Documents/Encyclopedia Magicka` · All `:N` anchors are **pre-change** line numbers in the named file; after Stage 1 lands, anchor by the section comments named here, not raw numbers.

---

## 0. Intent

Fix the broken sky, then rebuild everything that sits on it as one **elevation system**. The starfield becomes a genuinely full-viewport, area-proportional powder of dim stars, shaped by an elliptical "eyepiece gain" — calm (~50% brightness) behind the content zone, full brightness at the dome's rim — framed by an inverted "aperture" vignette that blooms *behind* the header/tab band instead of darkening the edges. Every text-bearing surface then sits on a named tier (E1–E5) whose fill alpha guarantees WCAG AA **even during the 750 ms aurora-boost transient**: `--star-white ≥ 12:1`, `--mist ≥ 5.9:1`, `--gold ≥ 9.5:1` on every tier (the **teal blob core** at boost is the binding case for gold/mist math — see §1.2 note).

On those tiers: the header becomes a legible instrument panel (three semantic groups, house-language SVG glyphs, two self-labeling text chips, a custom observatory-chip tooltip on every control with live state copy); the tab rail becomes engraved plaques (restoring DESIGN.md:183's "glass chips on an astrolabe rail" — the current transparent tabs are the deviation); the library becomes a flat near-opaque obsidian slab (no blur over the virtualized scroller); and hoards render as an **illuminated ledger manifest** — every item's resolved name, category, provenance, combine badge, and page refs visible by default, full trace one keypress away.

Hard constraints honored by construction: zero deps, classic scripts, one new file (`web/ui/tooltip.js`, auto-inlined by `web/build.py:38`'s verified `<script src>` regex), `file://`-safe, mobile pass and a11y pass un-regressed, sky.js perf guardrails kept.

---

## 1. Unified Token & Elevation Table

### 1.1 New/changed tokens (`web/css/theme.css:6-35` block — single edit, Stage 3)

| Token | Value | Notes |
|---|---|---|
| `--glass-fill-a` | `rgba(17,22,52,.82)` | **raised** from `.62` |
| `--glass-fill-b` | `rgba(9,12,26,.90)` | **raised** from `rgba(10,13,28,.72)` |
| `--mist-bright` | `#C7D3F2` | **NEW.** 13.5:1 on `--void`. The single "bright ink" token — tabs idle, seedbox, lens idle. **Supersedes Area A's `--mist-2:#B9C4E4` — that token is killed; do not ship both.** |
| `--surf-chrome-a` | `rgba(10,13,28,.92)` | E1 header gradient top |
| `--surf-chrome-b` | `rgba(10,13,28,.82)` | E1 header gradient bottom |
| `--surf-veil` | `rgba(5,6,14,.45)` | **Redefined** (Area A's `.78` value killed — see §2.1). Tab-rail scrim top stop, blur-free |
| `--surf-slab` | `rgba(10,13,28,.93)` | E3 library table |
| `--surf-slab-head` | `rgba(8,10,22,.96)` | E3 sticky header |
| `--surf-well-a` | `rgba(10,13,28,.55)` | inset well top (hoard manifest frame) |
| `--surf-well-b` | `rgba(5,6,14,.35)` | inset well bottom (manifest + `.mani-detail`) |
| `--surf-float-a` | `rgba(17,22,52,.97)` | E5 tooltip gradient top (+ caret below) |
| `--surf-float-b` | `rgba(8,10,22,.98)` | E5 tooltip gradient bottom (+ caret above) |

Unchanged but load-bearing: `--gold #E9C46A`, `--mist #9AA6C8`, `--mist-faint #5A6B8C` (**decorative-only**), `--gold-deep #8A6A2E` (**decorative-only — see §2.5, R12**), `--glass-stroke #2A3566`, `--glass-solid #0E1226`, `--magenta-lite #D98EEA`, kind tokens, motion tokens.

### 1.2 Elevation scale (append to DESIGN.md §2 in Stage 6)

| Tier | Name | Fill | Blur | Members | Worst-case text (during aurora-boost .28) |
|---|---|---|---|---|---|
| E0 | Cosmos | — | — | `#sky` (z-2), `.aurora` + `.vignette` (z-1) | n/a (no text) |
| E1 | Chrome | chrome-a→chrome-b gradient; rail: `--surf-veil`→transparent | header 14px (9px ≤640); **rail: none** | `.header`, `.tabrail` scrim, `.btn-icon` fill `rgba(5,6,14,.55)`, seedbox pill | mist ≥ 6.2:1, mist-bright ≥ 11:1 |
| E2 | Glass | glass-fill-a/b `.82/.90` | 14px (9px ≤640) | `.panel`/`.glass` result cards, `.grimoire` (`.88/.80` gradient; **`.94` flat, blur OFF** when ≤1023 overlay drawer — see §3.1.i), `.dialog` | star-white ≥ 12:1, mist ≥ 5.9:1, gold ≥ 9.5:1 |
| E2w | Well (inset on E2) | well-a/b `.55/.35` **over** E2 | none (inherits E2's) | `.manifest`, `.mani-detail` | composite ≥ .92 opaque → star-white ≥ 13:1, mist ≥ 8:1 |
| E3 | Slab | slab `.93` / head `.96`; **lens rail `.85→.78` gradient** | **none — ever** (virtualized scroller) | `.lib-table`, `.lib-head`, `.lib-lenses` rail, search box `rgba(8,10,22,.85)`, `.lib-count` chip `rgba(8,10,22,.9)` | **split floors:** slab — mist ≥ 5.9:1 over a raw masked star, teal pages ≥ 9:1; lens rail — `.cnt` mist ≥ 4.6:1, mist-bright label ≥ 7.5:1 (rim-bright fieldGain ≈1.0, .85-alpha star worst case) |
| E4 | Vault | scrim `rgba(5,6,14,.6)` | 4px | `.overlay` under E2 dialogs (composite ≈ .95) | inherited from E2 |
| E5 | Float | float-a/b `.97/.98` | **none** (→ no `.no-backdrop` fallback needed) | `.tip` tooltip (z:80), toast (existing, z:70) | tip-sub mist ≈ 7.4:1, tip-name star-white ≥ 14:1 |

**Z ladder (document, don't change existing):** −2 sky · −1 aurora/vignette · 2 lib-head (local) · 10 header · 50 splash · 55 supernova/grim-scrim · 60 overlay + mobile grimoire · 70 toast · **80 tip (new)** · 100 skip-link.

**Tier rule (goes in DESIGN.md):** anyone raising `aurora-boost` above `.28` or blob saturation must re-run the tier contrast math, **treating the teal blob core (b2, parked ~88vw under the grimoire/result zone) as the binding background for gold and mist**. Escape hatch order if E2 reads flat in preview: drop boost `.28 → .26` first; never lower glass fills below `.82`.

---

## 2. Cross-Area Resolutions (the explicit merge decisions)

**2.1 Tab rail — Area B's plaques win; Area A's veil/ink is killed.** Area A explicitly deferred tab *structure* to the controls area; Area B supplies engraved plaques with borders and fills. Shipping both = double-darkened band and two idle-ink tokens. Resolution: **kill** Area A's `.tabrail` veil (`rgba(10,13,28,.78)` fade), Area A's `.tab { color:--mist-2; text-shadow:0 1px 6px }` — entirely superseded. The rail scrim is Area B's lighter `linear-gradient(180deg, var(--surf-veil), rgba(5,6,14,0) 85%)` (token redefined to `.45`) because the tab band now has **four** stacked defenses: fieldGain center-dimming, the vignette top bloom (`.72`), the rail scrim, and the plaques themselves. Tuning order if the band reads as an empty black stripe in preview: rail scrim `.45 → .30` first; vignette bloom second; never touch `fieldGain`.

**2.2 One bright-ink token.** `--mist-bright:#C7D3F2` is the only new text token. It styles: idle `.tab` labels, `.seedbox`, and `.lens` idle (Area A specified `--mist-2` for lenses — remapped). `--mist-2` does not exist in the final design.

**2.3 Tooltip sits on the tier scale.** The `.tip` component's gradient becomes `linear-gradient(160deg, var(--surf-float-a), var(--surf-float-b))`; carets use `--surf-float-a` (below-trigger) / `--surf-float-b` (above). E5 is blur-free by design, so it needs no `.no-backdrop` fallback and adds nothing to the ≤640px blur budget. z:80 clears toast (70) and overlays (60); spatial collision with toast (bottom-center) is impossible for header-anchored tips but verified at 320px anyway.

**2.4 Hoard manifest sits on the tier scale.** `.manifest` frame = `linear-gradient(180deg, var(--surf-well-a), var(--surf-well-b))` **inset on the E2 result card** (composite ≥ .92 effective opacity behind item names — the manifest never floats on raw sky). In the grimoire popup it sits on an E2 dialog over the E4 scrim — same guarantee. `.mani-detail` background = `var(--surf-well-b)`.

**2.5 Ink hygiene is global law — now two named decorative-only tokens.** Nothing informational in the tooltip (`tip-sub` = `--mist`), manifest (`.m-roll`, `.m-pg.none`, `.m-pg .more` = `--mist`), or grimoire sub-line (`--mist`) may use `--mist-faint` **or `--gold-deep`** (3.9:1 on the well — R12). `--gold-deep` is reserved for borders, the ⬡ hex glyph, inset accents, and *ignited* states that pair with `--gold` text.

**2.6 Escape-key chain.** Order of operations when a tooltip is showing over an open modal: tooltip's capture keydown hides the tip **without** `stopPropagation` → `UI.openModal`'s capture handler (widgets.js:39-40, which DOES stopPropagation) closes the modal → controller's global Esc (controller.js:242) runs only when no modal consumed it. Test explicitly (§5.3).

**2.7 moveArc geometry has exactly one owner.** Only Area B changes tab geometry (padding 11px 20px 12px, 1px borders); Area A ships zero tab-geometry changes. `moveArc()` (controller.js:101-104) measures after class toggle and re-runs on resize/grimoire toggle (app.js:56-57) — verify arc alignment at 320px and 2000px, boot + tab switch + grimoire toggle.

**2.8 Reduced-effects single inventory** (one behavior list, all areas): sky → `drawStatic()` single paint *including* gain shaping + halos; aurora → `animation:none; opacity:.10`; tooltip fade → neutered by the existing global `.reduce-motion` transition kill (theme.css:473); manifest → no `maniReveal`, no `.ignite`, no caret transition; dice-cast already skipped (`ctrl.animate()` false). `prefers-reduced-motion` media block (:476-478) unchanged.

**2.9 Header regroup vs. responsive hides.** `#cmdk` moves into the Tools group — safe because all hides are id/class selectors (`#cmdk,#reduce` ≤900 at :424; `#hdrRandom,#ritual,#diag,.seed-label,#count` ≤560 at :468; `.seedbox .seed-label` still matches). The `:not(.wide)` width splits at :426/:436 are **load-bearing** — without them the new `ritual` text chip clips at 561–900px and 44px targets regress ≤640px. **New (R1): the ≤560 header-fit rules in §3.2.i are equally load-bearing — without them the seedbox pill squeezes the 44px buttons at 320px.**

**2.10 Shared reveal contract.** `UI.renderHoardManifest` returns the exact `{el, order, stagger}` shape of `UI.renderTrace` (stagger = `order.length > 18 ? 45 : 120`) so the cascade-arpeggio audio at result.js:154-156 works unmodified for both renderers.

**2.11 Killed redundancies (full list).** Area A's `--mist-2`; Area A's `.tabrail` `.78` veil + `.tab` restyle; Area A's `--surf-veil:.78` value (name kept, value `.45`); P2's near-opaque modal override (unnecessary — E2+E4 composite ≈ .95); P2's separate 24×24 icon dialect (one 32×32 glyph language); P1's bolt glyph for `#ritual` (text chip instead); P1's `children[0].label` hoard naming (provably wrong for assembled items); P2's first-page-only manifest column (all unique filled pages collected); the entire `collapseChildren` option in result.js (deleted, no caller remains); **`aria-pressed` on `#ritual`** (2.5.3 conflict — R15); **the `.tabrail::after` hairline pseudo** (scroll-container trap — R5, replaced by a background layer); **`Element.replaceChildren`** (platform-floor risk — R9, replaced by the codebase idiom).

**2.12 One toggle-announcement idiom per control class (R15).** Buttons whose *visible label is stable* (`#sound` ♪ glyph, `#reduce` "effects" chip, `#lock` glyph, `#grim` glyph) are **`aria-pressed` toggles** with stable accessible names (Sound / Reduce effects / Lock seed / Grimoire). `#ritual` is a **mode-swap button, not a toggle**: its visible label *is* the state ("ritual"/"rapid"), so it carries no `aria-pressed`; `C.setRapid` swaps both `textContent` and `aria-label` = `"Casting: ritual"` / `"Casting: rapid"` — the visible word is contained in the accessible name (WCAG 2.5.3 pass), and voice-control users can say "click ritual".

**2.13 Touch tooltip-confirmation marker (R15 consequence).** Post-touch state confirmation keys off a `data-tip-live` attribute (set on `#sound #ritual #reduce #lock #grim`), **not** `[aria-pressed]` — because `#ritual` no longer has `aria-pressed` but still deserves the 1100 ms confirmation tip.

---

## 3. Per-Area Specifications

### 3.1 AREA A — Sky, cosmos, and surfaces

**a) Canvas coverage + DPR-correct blit (Stage 1 — the bug fix).**

The bug (empirically confirmed): `#sky { position:fixed; inset:0; }` with no width/height leaves the canvas at its intrinsic attribute size (a canvas is a replaced element — `inset:0` does not stretch it), and `resize()` (sky.js:283-292) reads `canvas.clientWidth` — which echoes the canvas's OWN attribute size — then multiplies by `devicePixelRatio`, so every resize event **doubles** the canvas (measured 600×300 → 1200×600 → 2400×1200). Fix:

- `web/css/theme.css:56` →
  ```css
  #sky { position:fixed; inset:0; width:100%; height:100%; height:100lvh;
         z-index:-2; pointer-events:none; display:block; }
  ```
  The second `height:100lvh` declaration is a progressive enhancement (Chrome 108+/Safari 15.4+; older engines keep `100%`): with `lvh`, the canvas layout height **never changes across mobile URL-bar show/hide** — stars under the collapsed bar are simply cropped, so no rebuild and no visible re-scatter (R3). `top:0` + explicit height means `bottom:0` from `inset` is ignored (over-constrained) — harmless.
- `web/ui/sky.js` `resize()` (:283-292) rewritten:
  ```js
  var d = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  var r = canvas.getBoundingClientRect();
  var w = Math.round(r.width)  || window.innerWidth  || 0;
  var h = Math.round(r.height) || window.innerHeight || 0;
  if (w === W && h === H && d === dpr) return;   // no-op guard
  dpr = d; W = w; H = h;
  canvas.width  = Math.max(1, Math.round(W * dpr));
  canvas.height = Math.max(1, Math.round(H * dpr));
  buildLayout();
  if (reducedMotion || !running) drawStatic();
  ```
  Measures the **CSS rect**, never `canvas.clientWidth/clientHeight` before CSS sizing exists (that was the geometric-doubling feedback loop). On `lvh` browsers the rect is stable across URL-bar transitions, so the guard short-circuits and no rebuild occurs; on `100%`-fallback browsers, URL-bar transitions still trigger the (debounced, 150 ms) rebuild — same as the acceptable pre-existing behavior, honestly documented as such (R3: the earlier draft's claim that the equal-dims guard alone "stops URL-bar thrash" was false and is retracted).
- **Latent retina bug (ships in Stage 1):** `prerenderLayer` offscreens are `W*dpr` device pixels but were drawn with 3-arg `drawImage` under the dpr transform → base bitmap rendered at 2× on retina. Every bitmap draw becomes **5-arg with explicit CSS-unit destination size**: `ctx.drawImage(layer.off, ox, oy, W, H)` in `draw()` (:161) and `(0, 0, W, H)` in `drawStatic()` (:219). (Stage 2 extends these with PAD offsets.)

**b) Parallax overscan (Stage 2).** `var PAD = 24;` — buildLayout scatters over `(W+2*PAD)×(H+2*PAD)`; offscreens sized `(W+2*PAD)*dpr × (H+2*PAD)*dpr`; draws become `ctx.drawImage(layer.off, ox-PAD, oy-PAD, W+2*PAD, H+2*PAD)` / static `(-PAD,-PAD,…)`; twinkle arcs at `(s.x-PAD+ox, s.y-PAD+oy)`; `drawConstellations` offsets all coords by `-PAD`. The near layer's ±16px parallax never exposes unpainted strips.

**c) Area-proportional density (clamp lowered — R8).** Replace `var STAR_COUNT = 900;` with `var STAR_DENSITY_PX2 = 2400;` + `var throttleFactor = 1;`. `currentStarCount = Math.max(throttled ? 50 : 140, Math.min(950, Math.round((W*H)/(STAR_DENSITY_PX2*throttleFactor))));` — ~915 at 2000×1100 (today's intended look), ~127→140 floor at 375×812, and a **950 cap** (parity + margin) so ultrawide/4K viewports never pay more than ~+5% over today's hottest loop (the per-star twinkle arc/fill at sky.js:170-180). `maybeThrottle()` sets `throttleFactor = 2` then `buildLayout()`; keeps the one-shot `throttled` flag, `parallaxEnabled=false`, 1s EMA window, 50-star floor. Layer fracs .55/.30/.15 unchanged.

**d) Eyepiece gain.** Pure helper (no `rand()` — layout stays seed-stable):
```js
function fieldGain(x, y) {
  var nx = (x - PAD - W/2) / (W/2), ny = (y - PAD - H/2) / (H/2);
  var d = Math.sqrt(nx*nx*0.85 + ny*ny*0.55); if (d > 1) d = 1;
  var t = (d - 0.25) / 0.75; if (t < 0) t = 0; t = t*t*(3 - 2*t);
  return 0.5 + 0.5*t;
}
```
Stored per star as `s.gain`. Near layer only (`li===2`): `if (s.gain < 0.7) r = Math.min(r, 1.6);` — no fat dot under a headline. (Escape hatch: if grimoire-open shifts the content zone off-center at 1024–1280px, move ellipse center x to 0.46 viewport.)

**e) Brightness re-tune + halos.** `base: 0.28 + rand()*0.34` (.28–.62), `amp: 0.10 + rand()*0.20` (.10–.30); freq/phase unchanged. Bitmap wash `ctx.globalAlpha = 0.45` (was .55) in both `draw()` and `drawStatic()`. `prerenderLayer` stamps cores at `rgba(color, s.gain)`; for `s.r >= 1.6`, halo first: arc at `s.r*2.6`, fill `rgba(color, 0.10*s.gain)` (≈4.5% on-screen after wash). Twinkle: `if (tw > 0.85) tw = 0.85; tw *= s.gain; if (tw < 0.04) continue;`. `drawStatic`: `globalAlpha = Math.min(1, s.base) * s.gain`. Color mix unchanged (8% blue / 6% gold / 86% white).

**f) Constellations — rim-seeded, area-scaled.** `conCount = Math.max(3, Math.round(CONSTELLATIONS * Math.min(1, (W*H)/(1600*900))))`; centers: `ang = rand()*2π, rad = 0.55 + rand()*0.4; cx = PAD + W/2 + cos(ang)*rad*(W/2-60); cy = PAD + H/2 + sin(ang)*rad*(H/2-60);`; `lineAlpha *= fieldGain(cx,cy)` once at build. Node/edge construction, drift, colors unchanged.

**g) Aurora.** `.aurora .blob { opacity:.12 }` (was .14); positions: `.b1 { left:-18vw; top:-22vw }` (its core currently parks under the tab rail), `.b2 { right:-16vw; top:16vh }`, `.b3 { left:30vw; bottom:-24vw }`; sizes/gradients/drifts unchanged. **`aurora-boost` stays `.28`** (:74) — the "sky answers the dice" contract. `.reduce-motion .aurora .blob { animation:none; opacity:.10 }` (:475). Mobile blur(52px) (:464) unchanged.

**h) Aperture-frame vignette** (:71-73 →):
```css
.vignette { position:fixed; inset:0; z-index:-1; pointer-events:none; background:
  radial-gradient(100% 36% at 50% 0%,   rgba(8,10,22,.72), transparent 70%),
  radial-gradient(100% 30% at 50% 100%, rgba(5,6,14,.5),  transparent 70%),
  radial-gradient(140% 120% at 50% 45%, transparent 58%,  rgba(5,6,14,.5) 100%); }
```
Top bloom = defense-in-depth for the header/tab band; source order (paints above `.aurora`) kept.

**i) Surface retunes (Stage 3).** Header (:111) → `linear-gradient(180deg,var(--surf-chrome-a),var(--surf-chrome-b))`, blur kept. `.btn-icon` fill → `rgba(5,6,14,.55)` (:130). `.grimoire` (:294) → `linear-gradient(180deg,rgba(10,13,28,.88),rgba(7,9,20,.80))`, blur kept on the ≥1024 grid regime; **mobile overlay drawer (≤1023, :413) adds `background:rgba(8,10,22,.94); -webkit-backdrop-filter:none; backdrop-filter:none;`** (R6/R7) — behind a 94%-opaque fill the blur was ~6% visible but still cost a full-height compositor blur pass over the animating canvas on exactly the GPUs the mobile pass protects. This makes the E2 table's ".94 flat" wording literally true and **removes the grimoire from the ≤640 blur budget entirely**.

**j) Library = E3 slab, zero library.js changes.** `.lib-table` (:329) → `var(--surf-slab)` (still **no** backdrop-filter — 5,709-row virtualized scroller over a 60fps canvas); `.lib-head` (:331) → `var(--surf-slab-head)`; row border → `rgba(255,255,255,.05)`, zebra → `rgba(255,255,255,.03)`, hover → `rgba(76,166,255,.10)` (:338-340 — paddings/heights untouched, ROW_H 34/44 contract at library.js:6). **`.lib-lenses` (:314) → `background:linear-gradient(180deg,rgba(12,16,36,.85),rgba(9,12,26,.78)); border:1px solid var(--edge-hair); border-radius:14px; padding:8px;`** — raised from the draft's `.72/.62` (R13): the rail sits at the viewport rim where fieldGain deliberately runs ≈1.0 with twinkle ceiling .85, and the old fill let `.lens .cnt` (`--mist`, 11px mono) fall to ≈3.8:1 over a worst-case star pixel; at `.85/.78` the `.cnt` floor is ≥ 4.6:1 and the `--mist-bright` label ≥ 7.5:1, while the rail still reads visibly lighter than the .93 slab. `.lens` idle color → `var(--mist-bright)` (:316; hover/active unchanged). `.lib-search .box` (:322) → `rgba(8,10,22,.85)`. `.lib-count` (:327) adds `background:rgba(8,10,22,.9); padding:3px 10px; border-radius:8px;`.

**k) Text-token hygiene.** Switch to `color:var(--mist)`: `.trace-node .pg.none` (:279), `.trace-node .note` (:280), `.grim-empty` (:308), `.lib-row .c-page.none` (:348), `.lib-empty` (:351), `.palette-item .kbd` (:383). `--mist-faint` and `--gold-deep` remain decorative-only (§2.5).

**l) Fallback completeness.** After :106 add `.no-backdrop .header, .no-backdrop .grimoire { background:var(--glass-solid); }`. Rail veil, slab, well, float tiers are plain alpha — no fallback needed. Mobile block (:433-465): :463's 9px blur downgrade covers every remaining blurred tier (header + panels; **the grimoire drawer is no longer blurred at ≤1023** per §3.1.i).

### 3.2 AREA B — Header instruments, tooltips, tab rail

**a) Tooltip component — NEW `web/ui/tooltip.js`** (IIFE extending the existing `window.EMUI` namespace, classic script). The `<script src="ui/tooltip.js"></script>` tag goes in `web/index.html` between `ui/widgets.js` (:72) and `ui/result.js` (:73). **`web/build.py:38`'s regex inlines it — but the regex is exact-match, so the tag must be byte-identical in form to the existing ones: `<script src="ui/tooltip.js"></script>`, double quotes, no `defer`/`type`/whitespace variance** (R10; lines 43-44 are the leftover-ref sanity check, whose warning is the smoke test for getting this wrong).
- Singleton `<div class="tip" id="tip" role="tooltip" aria-hidden="true">` → `.tip-head` (`.tip-name` + optional `.tip-kbd`) + optional `.tip-sub`, built with `UI.el`.
- Data contract: `[data-tip]` (name line), `data-tip-sub`, `data-tip-kbd` (`Mod` → ⌘/Ctrl via `/Mac|iPhone|iPad/.test(navigator.platform||'')`), `data-tip-live` (marks state-swapping controls eligible for post-touch confirmation — §2.13).
- Delegated `document` pointerover/pointerout via `closest('[data-tip]')`: 120 ms cold show; 0 ms when open or within a 300 ms warm window after hide. `focusin` shows instantly when `el.matches(':focus-visible')` (try/catch → show on any focus); `INPUT` triggers are hover-only (`#seed` never fights typing); `focusout` hides.
- Position: fixed; centered under trigger `+8px`; clamped to 8px gutters; flips above on bottom overflow (class `.above`); caret tracks trigger center via `--tip-cx`.
- Dismiss: pointerout, focusout, `Escape` (**capture, NO stopPropagation** — §2.6), window resize, **and a document-level capture-phase passive `scroll` listener** (R18 — required because `[data-tip]` extends to the tabs.js:162 slot-randomizers inside the scrollable `.tabpanel`; guard on visible state first so it costs nothing when no tip shows).
- Touch: `pointerType==='touch'` hover ignored; after a touch **click** on a `[data-tip-live]` trigger, show 1100 ms as post-action state confirmation (setters have updated `dataset` by bubble time). Non-live triggers get no touch tip.
- **`pointer-events:none`** — accepts a strict WCAG 1.4.13 "hoverable" miss, documented in DESIGN.md a11y notes: all tip content is redundant with accessible names/`aria-pressed`/the `#more` menu, and the alternative creates a click dead-zone over the tab rail.
- **Show/hide ARIA lifecycle (R17):** `show()` sets `tip.setAttribute('aria-hidden','false')` and gives the trigger `aria-describedby="tip"`; `hide()` restores `aria-hidden="true"` and removes `aria-describedby`. `tip.classList.toggle('lit', trigger.matches('.active,.on'))` → gold name line.
- Export `UI.refreshTip()` — re-render + re-place if current trigger still in DOM (setters call it so hover copy flips live).
- **All `title=` attributes on header controls are DELETED** (replaced, never mirrored). `web/ui/tabs.js:162` slot-randomizers: `title` → `data-tip` (delegation covers free).

**b) Tooltip CSS** (append after the `.toast` block, ~:392) — E5 tier tokens per §2.3:
`.tip{position:fixed;z-index:80;max-width:260px;pointer-events:none;background:linear-gradient(160deg,var(--surf-float-a),var(--surf-float-b));border:1px solid var(--glass-stroke);border-radius:10px;padding:7px 10px 8px;box-shadow:0 10px 30px rgba(0,0,0,.6),inset 0 1px 0 var(--edge-hair),0 0 0 1px rgba(233,196,106,.05);opacity:0;transform:translateY(-3px);transition:opacity var(--dur-fast) var(--ease-out-expo),transform var(--dur-fast) var(--ease-out-expo)}` `.tip.show{opacity:1;transform:none}` carets: `.tip::before` 8×8 rotated square at `calc(var(--tip-cx,50%) - 4px)`, `background:var(--surf-float-a)`, glass-stroke top/left borders; `.tip.above::before` bottom variant, `background:var(--surf-float-b)`. `.tip-name{font-family:var(--f-display);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--star-white);white-space:nowrap}` `.tip.lit .tip-name{color:var(--gold)}` `.tip-kbd{margin-left:auto;font-family:var(--f-mono);font-size:10px;color:var(--mist);border:1px solid var(--glass-stroke);border-radius:5px;padding:1px 5px;background:rgba(5,6,14,.6)}` `.tip-sub{font-family:var(--f-prose);font-style:italic;font-size:12.5px;line-height:1.35;color:var(--mist);margin-top:2px}`.

**c) Copy deck** (name · state / sub / kbd):

| Trigger | Name line | Sub line | kbd |
|---|---|---|---|
| `#hdrRandom` | Roll a random item | Any table, any fate — one press. | R |
| `#seed` (hover-only) | Seed | The number that shaped this roll — type one and lock it to revisit. | |
| `#lock` off/on | Seed · unlocked / Seed · locked | Each roll draws a fresh seed — press to replay the one above. / Every roll replays the seed above — press to release. | |
| `#count` | Roll counter | Rolls made this session — echoed in each result's seed line. | |
| `#cmdk` | Command palette | Search every action, table, and artifact power. | Mod K |
| `#sound` off/on | Sound · off / Sound · on | Dice clicks and chimes are silenced — press to wake them. / Dice clicks and chimes — press to silence. | |
| `#ritual` | Casting · ritual / Casting · rapid | Full dice-cast ceremony on every roll — press for instant results. / No ceremony — press to restore the full ritual. | |
| `#reduce` off/on | Effects · full / Effects · reduced | Starfield motion and glow at full strength — press to calm. / Motion and glow dimmed for calm (and older GPUs). | |
| `#diag` | Diagnostics | Run the self-test and review data warnings. | |
| `#more` | More options | The full menu — everything the small screen hides. | |
| `#grim` open/hidden | Grimoire · open / Grimoire · hidden | Your roll history — pin the finds worth keeping. | Mod H |

**d) Icon strategy.** Text beats icons for the most opaque controls: `#ritual` becomes a `.btn-icon.wide` **text chip** (`ritual`/`rapid`, swapped by `C.setRapid` per §2.12); `#reduce` keeps its `effects` text chip; `#cmdk` keeps its text cap, boot-corrected to `⌘K` (Mac) / `Ctrl K`. Remaining glyphs join the house 32×32-viewBox / stroke-1.4 / currentColor SVG language — extend `GLYPHS` in `web/ui/widgets.js:99-110`:
- `lockOpen: 'M11 15v-4a5 5 0 0 1 9.6-1.9M8 15h16v12H8zM16 20.5v3.5'`
- `lockClosed: 'M11 15v-4a5 5 0 0 1 10 0v4M8 15h16v12H8zM16 20.5v3.5'`
- `note: 'M12 24V7l11-2.5V21M12 24a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM23 21a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'`
- `noteMuted:` same + `'M5 5l22 22'` (universal mute slash)
- `gear: 'M16 11.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM16 3.5v4.2M16 24.3v4.2M3.5 16h4.2M24.3 16h4.2M7.2 7.2l3 3M21.8 21.8l3 3M24.8 7.2l-3 3M10.2 21.8l-3 3'`
- `dots: 'M8.5 16h.01M16 16h.01M23.5 16h.01'` (rendered at strokeWidth 3.2, round caps → three crisp dots)

Widen `UI.glyph(name, size, strokeWidth)` (widgets.js:111) — third arg defaults 1.4, backward compatible. Mapping: lock→lockOpen/lockClosed (state swap) · sound→note/noteMuted (state swap) · diag→gear · more→dots(18, 3.2) · grim→existing `GLYPHS.book`. Sizes: 18px in 36px buttons, 16px in the lock. Emoji stay in markup as pre-boot fallback (splash covers the swap). Add `.btn-icon svg,.lock svg{display:block}` and `.lock{display:grid;place-items:center}`.

**e) Header regroup** (`web/index.html:23-40` rewrite): `#hdrRandom` · `.spacer` · **seedbox pill** (`background:rgba(5,6,14,.35); border:1px solid rgba(42,53,102,.55); border-radius:11px; padding:3px 6px 3px 10px;` color `var(--mist-bright)`; contains seed label, `#seed`, `#lock`, `#count`) · `.hdr-sep` · `div.hdr-group[role=group][aria-label="Session preferences"]` = `#sound #ritual #reduce` · `.hdr-sep` · `div.hdr-group[role=group][aria-label="Tools"]` = `#cmdk #diag #more #grim` (**#cmdk moves here** — all wiring is by id, zero JS churn). `.hdr-group{display:flex;align-items:center;gap:6px}` `.hdr-sep{width:1px;height:22px;flex:none;background:linear-gradient(180deg,transparent,var(--glass-stroke) 30%,var(--glass-stroke) 70%,transparent)}`, hidden ≤900px; `.seedbox{padding:2px 4px 2px 8px}` ≤900px.
ARIA: `aria-pressed="false"` on `#sound #reduce #lock` with stable labels (Sound / Reduce effects / Lock seed); **`#ritual` has NO `aria-pressed`** — accessible name from swapped `textContent` + `aria-label="Casting: ritual"/"Casting: rapid"` (§2.12, R15); `aria-keyshortcuts` on `#hdrRandom` (`R`), `#cmdk` (`Control+K Meta+K`), `#grim` (`Control+H Meta+H`); `#grim` gets `aria-controls="grimoire"` and ships `aria-expanded="false"` as a placeholder that **`C.syncGrimAria()` corrects at boot** (R4/R14 — never hardcode `"true"`: the <1024px drawer boots closed); `data-tip*` per copy deck; `data-tip-live` on `#sound #ritual #reduce #lock #grim`; **no `title=` anywhere**.

**f) Pressed treatment** (replaces :125, extends :133): `.btn-icon.active,.lock.on{color:var(--gold);border-color:var(--gold-deep);background:linear-gradient(180deg,rgba(233,196,106,.12),rgba(233,196,106,.03));box-shadow:inset 0 1px 0 rgba(251,231,168,.18),0 0 12px rgba(233,196,106,.22)}` — luminance cue (WCAG 1.4.1), redundant with glyph/text form-swap.

**g) Controller setters own state → (class, ARIA, glyph/text, tip copy)** — `web/ui/controller.js`. Glyph swaps use the codebase idiom `node.textContent = ""; node.append(UI.glyph(...))` — **not `Element.replaceChildren`** (R9: zero current uses; it would raise the JS floor to 2020 engines and a boot-time TypeError on older engines blanks the whole app, against the codebase's graceful-degradation posture):
- `C.setRapid(b)` (:150): class + `textContent = b?'rapid':'ritual'` + `aria-label = b?'Casting: rapid':'Casting: ritual'` (no aria-pressed — §2.12) + `dataset.tip/tipSub` per deck + `UI.refreshTip()`.
- `C.setReduce(b)` (:151-155): keep body-class/sky calls; add `aria-pressed` + Effects copy + refreshTip.
- `C.setMuted(b)` (:156-159): keep EMAudio; textContent-clear + `append(UI.glyph(b?'noteMuted':'note',18))`; `classList.toggle('active',!b)`; `aria-pressed=String(!b)`; Sound copy; refreshTip.
- **NEW** `C.setLock(b)`: class `on` + `aria-pressed` + glyph swap (`lockClosed`/`lockOpen`, 16) + Seed copy + refreshTip.
- **NEW** `C.syncGrimAria()` (R4/R14):
  ```js
  var open = matchMedia('(max-width:1023px)').matches
    ? C.dom.app.classList.contains('show-grim')
    : !C.dom.app.classList.contains('no-grim');
  C.dom.grim.setAttribute('aria-expanded', String(open));
  // + #grim tip copy per deck + UI.refreshTip()
  ```
  Called from three places: `C.toggleGrimoire()` after its class toggles; app.js **boot** (next to `C.selectTab("random")`); and the existing app.js:56-57 **resize listener** alongside `C.moveArc()` (crossing the 1023px breakpoint flips the effective open state with no class change — the resize hook is what keeps it honest).
- `C.toggleGrimoire()` (:160-165): after class toggles, call `C.syncGrimAria()`.
- `#more` menu vocabulary sync (:93-96): "Casting → Ritual (full ceremony)/Rapid (instant)", "Effects → full/reduced", "Sound → on/off" (WCAG 3.2.4 — one language on both surfaces).
- `web/ui/app.js`: register `C.dom.grim` (:13); after backdrop detect (:19) call `window.EMUI.initTooltips()` + static glyph installs (`diag`→gear, `more`→dots(18,3.2), `grim`→book(18), `#cmdk` platform text); lock handler (:36) → `C.setLock(!C.dom.lock.classList.contains('on'))` + uiTick; boot `C.setLock(false)` + `C.syncGrimAria()`; hash-restore (:51) → `C.setLock(true)` (structurally fixes the stale-copy edge).

**h) Tab rail — engraved plaques** (replace :157-165, **keep `.tab-arc` :164-165 verbatim**). The engraved hairline is a **background layer, not a pseudo** (R5/R11): at ≤900px the rail is an `overflow-x:auto` scroll container (theme.css:428), and an abspos `::after` inside a scroll container is sized to the static padding box and scrolls away with the content — scrolled-in plaques would sit on no baseline. Element backgrounds are border-box-anchored and stay put across the visible scrollport at every scroll position, exactly like the scrim:
```css
.tabrail{display:flex;align-items:flex-end;gap:8px;padding:12px 18px 0;position:relative;
  background:
    linear-gradient(90deg,var(--glass-stroke) 0%,var(--glass-stroke) 55%,transparent)
      left 18px bottom 0 / calc(100% - 36px) 1px no-repeat,   /* engraved baseline */
    linear-gradient(180deg,var(--surf-veil),rgba(5,6,14,0) 85%)}  /* rail scrim */
/* no ::after — killed (§2.11) */
.tab{position:relative;border-radius:12px 12px 0 0;padding:11px 20px 12px;color:var(--mist-bright);cursor:pointer;
  font-family:var(--f-display);font-weight:600;letter-spacing:.08em;font-size:14px;text-transform:uppercase;
  text-shadow:0 1px 3px rgba(5,6,14,.9);
  background:linear-gradient(180deg,rgba(10,13,28,.38),rgba(10,13,28,.62));
  border:1px solid rgba(42,53,102,.45);border-bottom:0;
  transition:color var(--dur-base),background var(--dur-base),border-color var(--dur-base)}
.tab:hover{color:var(--star-white);border-color:var(--glass-stroke);background:linear-gradient(180deg,rgba(17,22,52,.5),rgba(10,13,28,.7))}
.tab.active{color:var(--gold);text-shadow:0 1px 3px rgba(5,6,14,.9),0 0 16px rgba(233,196,106,.3);
  border-color:rgba(138,106,46,.7);background:linear-gradient(180deg,rgba(233,196,106,.09),rgba(10,13,28,.66))}
```
14px per DESIGN.md:110 (not 13). Markup (index.html:42-48) unchanged — tablist/roving-tabindex/moveArc untouched. Cinzel 600 is a real embedded face (fonts.css ships 500/600/700).

**i) Load-bearing mobile width splits + 320px header fit (R1).**
- :426 → `.header .btn-icon:not(.wide),.header .lock{width:40px;height:40px}` `.header .btn-icon.wide{height:40px}`.
- :436 → `.btn-icon:not(.wide),.lock,.header .btn-icon:not(.wide),.header .lock{width:44px;height:44px}` `.btn-icon.wide{height:44px}` (wide keeps auto width + `0 10px` padding from :134).
- **NEW ≤560px rule set** (the seedbox pill would otherwise push the visible row past 320px and flex-shrink would silently squeeze the 44px targets to ~41px):
  ```css
  .header{gap:6px}
  .header .btn-icon,.header .lock,.hdr-group{flex:none}     /* buttons NEVER shrink; overflow becomes visible, not silent */
  .seedbox{flex:0 1 auto;min-width:0;padding:2px 4px 2px 6px}  /* the pill is the designated shrinker */
  .seedbox input{width:48px;min-width:0}                     /* 16px font kept — mobile-pass contract */
  ```
  Budget at 320px (dropcap ~20 + pill ≈104 + 3×44 buttons + 5×6 gaps + 16 padding ≈ 302px) fits with margin; `.seed-label` and `#count` are already hidden at ≤560 (:468, unchanged — `#ritual` still hides there too, so the chip is only ever visible >560px).

### 3.3 AREA C — Hoard Manifest

**a) Renderer switch.** Hoards render `UI.renderHoardManifest` instead of a collapsed trace; `collapseChildren` (result.js:59-64 + option + the `res.root.table==="hoard"` flag at :145) is **deleted**. `reveal()` (:145):
```js
const t = res.root.table === "hoard"
  ? UI.renderHoardManifest(res.root, { animate: ctrl.animate(), engine: ctrl.engine })
  : UI.renderTrace(res.root, { animate: ctrl.animate() });
```
Same `{el, order, stagger}` contract (§2.10).

**b) Exact names.** `web/js/engine.js` `rollHoard` loop (:153):
```js
for (let i = 0; i < k; i++) {
  const it = this.rollRandomItem();
  it.root.summary = it.headline;   // exact display name, handles assembled armor/weapon ('+2 Chain Mail')
  children.push(it.root);
}
```
Additive field; determinism unaffected. Legacy persisted roots healed at render: `UI.ensureHoardSummaries(root, engine)` in result.js backfills `m.summary = engine.headline(m)` (pure over the tree — verified touches no ds/roller state) with `try/catch → m.label`; backfills persist on the next grimoire `save()`. Display name/marks = `summary.split("  ·  ")` exactly as `setHeadline` does (result.js:128-130).

**c) Shared derivation in `web/js/format.js`** (engine-free — reads `m.summary || m.label`): `EM.hoardItems(root)` → per master child: `{n, name, marks, cat (m.kind==="gap" ? "" : m.label), pages (ALL unique filled `EM.pageText` values in subtree order), unindexed, flags{reroll,enh,cap}, gap, node}` via one subtree walk. `EM.hoardManifestLines(root)` → `'03. Chain Mail +2 — Armor — p.234, p.871  ·  +1 combined'` style lines. **One shared block builder (R21): `EM.hoardBlock(root)` = `[...EM.hoardManifestLines(root), "", "— full trace —", ""]`** — used by BOTH `EM.resultToText` (:44-49: after `[headline, ""]`, if hoard → push `...EM.hoardBlock(root)` before `traceLines`) and history.js `doExport` (§3.3.h), so Copy and Export serialize hoards identically. `traceLines` untouched (non-hoard copies byte-identical).

**d) Structure (ARIA-correct — toolbar OUTSIDE the list).** `div.manifest` (no role) → [`div.mani-bar`, `div.mani-list[role=list][aria-label=root.label]` → k × `div.mani-item[role=listitem]`]. `.mani-bar`: `.mani-sum` = `⬡ 12 items · 3 combined · 1 enchanted` (combined = `EM.countKinds(root, new Set(['reroll','enhancement']))`, enchanted = `EM.countKinds(root, new Set(['enhancement']))` — **the second argument is a `Set`; a literal object crashes on `kinds.has`** (R22a; engine.js:27-31, cf. the correct call at result.js:155) — matches engine.headline semantics engine.js:242-243; zero segments omitted; ⬡ aria-hidden) + `button.btn.btn-ghost.mani-all` "Expand all traces" ↔ "Collapse all traces", **recomputed from the DOM** on every per-row toggle (stateless — can never desync). **Mixed-state rule (R22b): label = "Collapse all traces" iff EVERY `.mani-head` has `aria-expanded="true"`; any other state (including mixed) → "Expand all traces".**

**e) Row anatomy.** Whole row = one native `<button class="mani-head" id="mani-h-{seq}-{i}" aria-expanded aria-controls="mani-d-{seq}-{i}">`, grid `18px 30px minmax(0,1fr) auto`: caret (aria-hidden, −90° closed) | `.idx` mono `01` — **closed state `color:var(--mist)`** (R12: the draft's `--gold-deep` computed 3.86:1 on the E2w well, an AA fail for informational small mono — the ordinal is mirrored in copy/export so it IS informational); ignites `--gold` + text-shadow when open (engraved-dormant/lit-gold house language preserved) | `.m-main`: `.m-name` 16px `--f-prose` `--star-white`, `overflow-wrap:break-word` — **names wrap, never truncate** — + `.count-badge` `--magenta-lite` marks text — **this badge must NOT be aria-hidden** (R19: unlike the headline badge at result.js:135 — here it is the accessible carrier for the flag info); **when `flags.cap`, append an sr-only `' · reroll cap reached'` inside `.m-main`** (R19: the marks text encodes reroll/enhancement but not cap; without this the ⊘ has no text equivalent) | `.m-meta`: `.m-cat` Cinzel 11px uppercase `--gold` + `.m-roll` mono 11px `--mist` (`EM.whereText(m)` + inner tid/where) + `.m-flags` ⟳/✦/⊘ kind-colored, `drop-shadow(0 0 5px currentColor)`, each aria-hidden (decorative — badge + sr-only text carry the info, sidestepping `--kind-enhancement`'s 3.2:1) | `.m-pg` mono 12px `--aurora-teal`, `min-width:64px` right column: `pages[0]` + `.more` `+N` in `--mist`; no pages → `—` + sr-only "no page reference"; unindexed → italic `--mist` "not in index". Gap rows: `.mani-item.gap`, italic `--kind-gap` name, still expandable. ids use module-level `maniSeq++` — result panel and grimoire popup can coexist.

**f) Lazy detail + choreography.** First open: `detail.append(UI.renderTrace(m, {}).el)` + built flag; then flip `.open`/`hidden`/`aria-expanded` and resync mani-all label per §3.3.d's rule. `.mani-detail[role=group][aria-labelledby=head-id][hidden]` — embedded trace keeps `role=tree` (valid widget inside a group), pixel-identical to every other trace. `opts.animate`: first 40 rows `.ignite` (reuses `@keyframes nodeIgnite`) at `i*stagger`; `maniReveal` 260 ms unfurl on open; both dead under `.reduce-motion`.

**g) Keyboard.** Container keydown on `.mani-head`: ArrowDown/ArrowUp rove through `querySelectorAll('.mani-head')`, Home/End jump, each `preventDefault()`; Tab flows naturally into expanded traces/footer. Enter/Space free on native buttons.

**h) Grimoire.** `addRow` (history.js:71-78): hoard guard `e.root && e.root.table === "hoard" && e.root.children && e.root.children.length` → `ensureHoardSummaries` → `.g-col` wraps head + `.g-sub` = first 3 `EM.hoardItems` names `·`-joined + `+N more` where **`N = e.root.children.length - 3`, suffix omitted when `N ≤ 0`** (R16: the draft's "N from children.length" literally rendered "+12 more" on a 12-item hoard; the intent was only to warn against a sliced-array length). `openPopup` (:90) → hoard renders the manifest (`{engine: ctrl.engine}`), else trace; manifest's Expand-all replaces the old fully-expanded view in one click. `doExport` (:123-128): hoard → `EM.hoardBlock(root).join("\n")` prepended to `traceLines` (R21 — identical block shape to Copy).

**i) Manifest CSS** — insert after end of TRACE TREE (~:290), before `/* GRIMOIRE */`; well tokens per §2.4:
`.manifest{margin-top:4px;border:1px solid rgba(233,196,106,.16);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,var(--surf-well-a),var(--surf-well-b));box-shadow:inset 0 1px 0 var(--edge-hair),inset 0 0 48px rgba(110,76,216,.05)}` · `.mani-bar{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid rgba(233,196,106,.14);background:linear-gradient(90deg,rgba(233,196,106,.05),transparent 70%)}` · `.mani-sum{font-family:var(--f-display);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);min-width:0}` `.mani-sum .hex{color:var(--gold-deep);margin-right:6px}` `.mani-all{margin-left:auto;padding:5px 10px;font-size:11px}` · `.mani-item{border-bottom:1px solid rgba(233,196,106,.08)}` last-child 0 · `.mani-head{display:grid;grid-template-columns:18px 30px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;text-align:left;padding:9px 14px 9px 10px;min-height:44px;cursor:pointer;background:transparent;border:0;color:inherit;font:inherit;transition:background var(--dur-fast)}` hover `rgba(76,166,255,.05)`; focus-visible `outline:2px solid var(--astral-blue);outline-offset:-2px;border-radius:8px` · caret/idx rules per (e) — `.mani-head .idx{color:var(--mist)}`, open head: idx `color:var(--gold);text-shadow:0 0 10px rgba(233,196,106,.4)` + head `linear-gradient(90deg,rgba(233,196,106,.05),transparent 60%)` + `inset 2px 0 0 var(--gold-deep)` · `.m-*` rules per (e) · `.mani-detail{padding:2px 10px 10px 12px;margin:0 8px 8px 40px;background:var(--surf-well-b);border-left:1px dashed rgba(233,196,106,.28);border-radius:0 0 9px 9px}` + `maniReveal` keyframes + `.reduce-motion` kills · grimoire `.g-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}` `.g-sub{font-family:var(--f-prose);font-size:12px;color:var(--mist);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}` (after :306).
**≤640px** (inside existing block :433-465): `.mani-head{grid-template-columns:18px minmax(0,1fr) auto;padding:10px 12px 10px 10px}` `.mani-head .idx{display:none}` `.mani-detail{margin-left:12px}` · **NEW (R2): `.mani-bar{flex-wrap:wrap;row-gap:6px;padding:8px 12px}` `.mani-sum{white-space:normal;line-height:1.5}`** — at 320px the manifest interior is ~224px while the full three-segment summary alone is ~264px; the summary wraps to two lines and `.mani-all` (keeping `margin-left:auto`) right-aligns on its own wrapped row. The label text stays constant ("Expand all traces") — no second vocabulary at narrow widths; `.mani-all` inherits `.btn{min-height:44px}` on mobile — do not override.
**≤400px** new block: `.m-roll{display:none}`. Trace-tree CSS untouched — `.trace-node.collapsed` still serves per-branch collapse inside mounted traces.

---

## 4. Implementation Stages (file-by-file)

**Stage 1 — Sky correctness (ship alone; everything else is judged on top of it).**
- `web/css/theme.css:56` — `#sky` gains `width:100%; height:100%; height:100lvh; display:block;` (§3.1.a).
- `web/ui/sky.js:283-292` — `resize()` rewrite (§3.1.a): rect-measured, equal-dims guard, never reads `canvas.clientWidth` pre-CSS-sizing.
- `web/ui/sky.js:161, :219` — 5-arg `drawImage(layer.off, ox, oy, W, H)` / `(0,0,W,H)` (retina 2×-blur fix).
- Exit: DevTools — `canvas.width === Math.round(innerWidth*dpr)` stable across 5 consecutive resizes (no doubling); stars cover all four viewport corners at 320px and 2000px; base dots align with twinkle overlays at dpr 1 and 2; reduce-effects static paint matches running positions; **mobile emulation: URL-bar show/hide causes no canvas resize on `lvh`-capable engines (guard short-circuits — no `buildLayout` call logged)** (R3).

**Stage 2 — Living cosmos re-tune.**
- `web/ui/sky.js` — `STAR_DENSITY_PX2=2400` + `PAD=24` + `throttleFactor` (:20 area); **950 clamp** (§3.1.c); `fieldGain` helper; `buildLayout` (density clamp, padded scatter, base/amp re-tune, `s.gain`, near-layer 1.6px cap, constellation count/rim-seed/lineAlpha×gain); `prerenderLayer` (padded offscreens, gain-alpha cores, halos r≥1.6 → r×2.6 @ .10×gain); `draw()` (wash .45, PAD-offset 5-arg blits, twinkle ceiling .85 × gain, .04 cutoff, arc offsets); `drawStatic()` (same offsets, `base×gain`); `drawConstellations` (−PAD); `maybeThrottle` (`throttleFactor=2` → `buildLayout()`). **No API changes** — `S.init/S.setReducedMotion/S.destroy`, visibility pause, 150 ms debounce, pointer lerp .06, MAX_DPR 2, frame try/catch all stay.
- `web/css/theme.css` — aurora :59 `.12`, blob positions :62/:65/:68, vignette :71-73 aperture frame, :475 reduced-motion aurora `.10`.
- Exit: PAD consistency smoke test — reduce-effects ON vs OFF show identical star positions; no unpainted edge strips during pointer parallax; ~140 stars at 375×812 (log `currentStarCount`); throttle test under DevTools 6× CPU (one-shot, survives resize); **perf gate (R8): log `smoothedDelta` at 2560×1440 emulation, dpr 1 and dpr 2 — require ≥55 fps sustained without tripping `maybeThrottle`** (the 950 cap should make this trivially pass; if it doesn't, the density constant is wrong, not the cap).

**Stage 3 — Surface elevation system (tokens + all surfaces).**
- `web/css/theme.css` — token block edit (§1.1, includes `--mist-bright` for Stage 4); header :111; `.btn-icon` :130; grimoire :294 + **mobile :413 `.94` + `backdrop-filter:none` both prefixes** (R6/R7); library slab + **lens rail `.85/.78`** :314-351 set (§3.1.j, R13); text hygiene :279, :280, :308, :348, :351, :383; `.no-backdrop` additions after :106.
- Exit: `preview_inspect` computed backgrounds on `.panel`, `.lib-table`, `.lib-head`, `.lib-lenses`, `.grimoire` (both regimes — drawer must show `backdrop-filter:none`), `.header`; contrast spot-checks (§5.3); trigger a roll — text on every tier stays readable during the boost; zebra/hover still visible on the slab; sticky-header ghosting check (if visible, `.lib-head` → `var(--glass-solid)`, zero contrast cost).

**Stage 4 — Instruments & rail (controls + tooltips + tabs).**
- NEW `web/ui/tooltip.js` (§3.2.a — incl. aria-hidden lifecycle, scroll dismiss, `data-tip-live` touch rule).
- `web/index.html` — header rewrite :23-40 (§3.2.e; delete all `title=`; `#grim aria-expanded="false"` placeholder; `data-tip-live` set); script tag between :72/:73, **byte-identical form `<script src="ui/tooltip.js"></script>`** (R10); tab markup :42-48 **unchanged**.
- `web/css/theme.css` — tip component (~:392); pressed treatment :125/:133 + svg display rules; `.hdr-group`/`.hdr-sep` after :126 (+ ≤900 hide); seedbox pill :118-119 (+ ≤900 padding); tab rail :157-165 (background-layer hairline, keep `.tab-arc`); width splits :426/:436; **≤560 header-fit rules (§3.2.i, R1)**.
- `web/ui/widgets.js:99-111` — six glyph paths + `UI.glyph` third arg.
- `web/ui/controller.js` — setters :150-165 (+ new `setLock`, + new `syncGrimAria`, `setRapid` per §2.12), `#more` vocab :93-96.
- `web/ui/app.js` — :13 `C.dom.grim`; post-:19 initTooltips + glyph installs + cmdk text; :36 lock handler; boot `setLock(false)` + **`syncGrimAria()`**; :51 `setLock(true)`; :56-57 resize listener adds **`syncGrimAria()`** beside `moveArc()`.
- `web/ui/tabs.js:162` — `title` → `data-tip`.
- Exit: tab-arc alignment (boot/switch/grimoire-toggle at 320 & 2000px); **320px: header fits with zero flex overflow and every touch target ≥44px (measure `.btn-icon`/`.lock` rects)** (R1); ritual chip unclipped at exactly 561/640/900px; header no flex overflow at 1000px (fallback: hide `.hdr-sep` ≤1023 or pill padding `2px 4px`); **engraved baseline visible under scrolled-in plaques at 320px mid-scroll** (R5); tooltip flip/clamp at screen edges; **tip hides on `.tabpanel` wheel-scroll with pointer stationary over a slot-randomizer** (R18); Esc chain (§2.6) with modal open + tip showing; VoiceOver: "Sound, toggle button, pressed" AND **`#ritual` announces as "ritual, button"/"Casting: rapid" — visible word contained in the name; voice-control "click ritual" targets it** (R15); **`aria-expanded` on `#grim` correct at boot at 320px (false) and 1280px (true), and stays correct after resizing across 1023px** (R4/R14); touch tap on `#sound` at 320px (no toast collision); **`aria-describedby="tip"` present AND `tip[aria-hidden="false"]` only while visible — symmetric check** (R17).

**Stage 5 — Hoard manifest.**
- `web/js/engine.js:153` — summary capture (§3.3.b).
- `web/js/format.js` — `EM.hoardItems`, `EM.hoardManifestLines`, **`EM.hoardBlock`** (R21), `EM.resultToText` hoard block.
- `web/ui/result.js` — `maniSeq`, `UI.ensureHoardSummaries`, `UI.renderHoardManifest` (after :72), reveal switch at :145, **delete** collapseChildren block :59-64.
- `web/ui/history.js` — addRow :71-78 hoard branch (**`+N more` with `N = children.length − 3`**, R16), openPopup :90, doExport :123-128 (**uses `EM.hoardBlock`**).
- `web/css/theme.css` — manifest section (~:290, idx = `--mist` closed per R12), grimoire `.g-col/.g-sub` (after :306), ≤640 rules inside :433-465 (**incl. `.mani-bar` wrap, R2**), new ≤400 block.
- Exit: deterministic script — lock seed → hoard k=12 → every row shows caret|idx|name(+badge)|cat · d100→N · A? d1000→NNN|p.X(+N); an armor/weapon in the seed run shows the **resolved** name ("+2 Chain Mail"), never "Armor"; Enter/click → identical trace; Expand/Collapse all resyncs from DOM **including the mixed state (expand 1 of 12 → label reads "Expand all traces")** (R22b); ArrowUp/Down/Home/End rove; **Copy and Export produce the identical manifest block + "— full trace —" separator** (R21); **grimoire row for k=12 shows 3 names + "+9 more"** (R16); sub-line ellipsized in the ≤1023 drawer; popup shows the manifest; replay reproduces; **pre-change hoard entry in localStorage backfills names via `engine.headline`**; simultaneous panel + popup manifests have unique ids; **320px: `.mani-bar` wraps cleanly, `.mani-all` ≥44px tall** (R2); **a cap-flagged item exposes "reroll cap reached" to VoiceOver from the closed row** (R19); **`.idx` computed color is `--mist` closed / `--gold` open** (R12).

**Stage 6 — Docs, build, full regression.**
- `web/DESIGN.md` — §2: elevation table + tier rule (§1.2, incl. split E3 floors and the teal-blob binding-case note); §4 clause 4: aperture frame + density/gain/halo values + the `lvh` sizing rationale; §8 :345-346: Hoard Manifest spec (replaces "small collapsed constellation"); RollStep description: optional `summary` field; must-have 9 (:404): hoard copy/export leads with manifest; header/tab sections: plaques (re-aligned with :183), tooltip component, `--mist-bright`, group semantics, **the two toggle idioms (§2.12)**; a11y notes: documented 1.4.13 pointer-events:none tradeoff (do not "fix" into the dead-zone variant); ink-hygiene law names **both** `--mist-faint` and `--gold-deep` as decorative-only.
- `python3 web/build.py` → confirm `tooltip.js` inlined, **zero leftover-external-ref warnings** (the :43-44 check is the gate for a malformed script tag); open `dist/magica_roller.html` via `file://` and smoke the full flow.
- ~~Follow-up ticket: port `rollHoard` summary + manifest lines to `desktop/enc_roller`.~~ **DONE (2026-07-01):**
  desktop now at functional parity — `RollStep.summary` capture in `roll_hoard`, `hoard_items/hoard_manifest_lines/
  hoard_block/ensure_hoard_summaries` in `ui/format.py`, glanceable Treeview manifest (resolved names + pages at
  top level, cascade collapsed one level down) in `ui/widgets.py`, manifest-led Copy/Export + legacy healing in
  `ui/history_panel.py`. 7 new tests in `tests/test_hoard.py` (53 total green). Bells/whistles (tooltips, theme,
  starfield, animations) intentionally NOT ported — desktop is Tkinter.

---

## 5. Test & Verification Plan

**5.1 Automated suites (run after every stage, must stay green).**
- Web: `web/tests/run.js` (engine determinism, selftest). Verified: no test snapshots RollStep shapes, so `summary` is safe; hoard `resultToText` changes deliberately alter hoard copy output — if any test asserts hoard text, update it in the same commit with a note.
- Desktop: the `desktop/` suite (untouched code — must pass unchanged, proving zero cross-app leakage).
- `#diag` self-test from the UI passes in both `web/index.html` and the dist build.

**5.2 Preview functional matrix** (preview_start + snapshot/eval; widths **320** / 375 / 561 / 640 / 900 / 1000 / 1280 / 2000):
canvas dims correct at each width and after 5 resizes; all four tabs render, **baseline present under scrolled plaques ≤900**; grimoire toggle both regimes (≥1024 grid / <1024 drawer + scrim, **drawer blur off**); modals focus-trap + Esc; palette; library scroll perf (no jank with slab), sort, search, detail modal; hoard flow end-to-end incl. rapid mode, reduce-effects, and Ctrl/⌘+Z back-stack; keyboard: R/Space, 1-4, Ctrl+F/H/K, `?`, tab-rail arrows, manifest roving; toggles announce state changes (aria-live headline still fires); `#grim` aria-expanded correct at boot and across the 1023px resize.

**5.3 Contrast verification — `preview_inspect` computed values, never screenshots** (per DESIGN.md rules): idle `.tab` `--mist-bright` on plaque ≥ 11:1; active gold ≥ 8.5:1; `.tip-sub` ≥ 7:1; `.m-name` on manifest-over-E2 ≥ 12:1; **`.mani-head .idx` (`--mist`) ≥ 8:1 closed** (R12); `.m-roll`/`.m-pg` ≥ 5.9:1; library `--mist` page-dash ≥ 5.9:1; **`.lens .cnt` ≥ 4.6:1 on the raised lens rail** (R13); each re-checked **mid aurora-boost** (trigger a roll, sample within 750 ms) **against the teal blob core as the binding background** (R20).

**5.4 Degraded modes.** Reduce-effects ON: single static paint with gain+halos, frozen aurora `.10`, no tip fade, no manifest animation, no dice cast. `prefers-reduced-motion` via OS emulation. `.no-backdrop` boot flag forced: `.glass`, `.header`, `.grimoire` all get `--glass-solid`. DPR 1 vs 2 star-bitmap alignment. DevTools CPU throttle → one-shot star halving survives resize. `lvh`-fallback engines (emulate by forcing `height:100%`): URL-bar transitions rebuild via the existing 150 ms debounce, no doubling.

**5.5 Mobile pass regression checklist** (explicit, per hard constraint): 44px targets (incl. new wide chips ≥44 tall, manifest heads ≥44, **header buttons at 320px with the pill present** — R1), 16px inputs (**incl. the shrunken 48px-wide `#seed`**), safe-area insets, `#more` menu ≤560 with state-aware labels matching the new vocabulary, bottom sheets, 9px blur downgrade, aurora blur(52px), library single-column with ROW_H 44 intact, **grimoire drawer opens with zero backdrop-filter cost** (R6/R7).

**5.6 Data/persistence.** Seed a pre-change hoard grimoire entry in localStorage before upgrading → names backfill, entry persists healed on next save; pin/label/export all function; 200-entry cap unaffected.

---

## 6. Review Notes — critique dispositions

All seven must-fix findings are folded in; the remainder were accepted or adapted as recorded. (R6≈R7, R5≈R11, R4≈R14 were duplicate findings — one disposition each.)

| # | Finding (short) | Disposition | Where |
|---|---|---|---|
| R1 | 320px header overflow silently shrinks 44px targets | **Must-fix — ACCEPTED.** ≤560 rules: `flex:none` on buttons/groups (overflow becomes visible, never silent), seedbox = designated shrinker, `#seed` 48px, header gap 6px; 320px exit criterion added. | §3.2.i, §2.9, Stage 4 exit |
| R2 | `.mani-bar` can't fit at 320px, no wrap rule | **Must-fix — ADAPTED.** `flex-wrap` + `row-gap` + summary allowed to wrap to two lines; `.mani-all` keeps `margin-left:auto` (right-aligns on its wrapped row). Rejected the "shorten label at ≤400" variant — the label is JS-owned text and a second vocabulary at narrow widths buys nothing once wrapping fits. | §3.3.i, Stage 5 exit |
| R3 | resize() guard does not stop URL-bar thrash; claim was false | **ACCEPTED (option A).** `height:100lvh` progressive enhancement + rect measurement → layout never changes across bar transitions on modern engines; guard short-circuits; false claim retracted and fallback behavior documented honestly; exit criterion added. | §3.1.a, Stage 1 exit, §5.4 |
| R4/R14 | `#grim` hardcoded `aria-expanded="true"` wrong at mobile boot + stale across 1023px resize | **Must-fix — ACCEPTED.** New `C.syncGrimAria()` called at boot, in `toggleGrimoire`, and from the existing resize listener; markup ships `"false"` placeholder; boot + resize exit checks added. | §3.2.e/g, Stage 4 exit |
| R5/R11 | `.tabrail::after` baseline detaches inside the ≤900 scroll container | **ACCEPTED.** Hairline folded into the `.tabrail` background stack (border-box-anchored, scroll-immune); `::after` killed entirely. | §3.2.h, §2.11, Stage 4 exit |
| R6/R7 | ≤1023 grimoire drawer keeps backdrop blur behind a .94 fill — GPU waste, spec-inconsistent with ".94 flat" | **ACCEPTED.** `backdrop-filter:none` (both prefixes) added to the :413 drawer rule; §3.1.l blur budget updated — drawer drops out entirely. | §3.1.i/l, §1.2 E2 row, §5.5 |
| R8 | Star cap 1100 = unmeasured +22% on the hottest loop | **ADAPTED (both halves).** Clamp lowered to **950** (parity + margin — the reference look needs ~915, the extra 150 had no stated visual justification) AND the 2560×1440 dpr1/dpr2 ≥55fps measurement added as a Stage 2 gate anyway. | §3.1.c, Stage 2 exit |
| R9 | `replaceChildren` raises the JS floor; boot-time TypeError blanks the app | **ACCEPTED.** Codebase idiom `textContent=""` + `append()` in `setMuted`/`setLock`; grep confirms zero current `replaceChildren` uses. | §3.2.g, §2.11 |
| R10 | build.py anchor wrong (:38 not :44); regex is exact-match | **ACCEPTED.** Anchor corrected (verified against the file); byte-identical-tag requirement stated; :43-44 leftover-ref warning kept as the mandatory gate. | §3.2.a, Stage 4/6 |
| R12 | `.idx` in `--gold-deep` = 3.86:1 AA fail on the well; ink law had a gap | **Must-fix — ACCEPTED.** Closed idx = `--mist` (≈8:1), gold ignition + text-shadow on open preserved; §2.5 law extended to name `--gold-deep` decorative-only. | §3.3.e/i, §2.5, §5.3 |
| R13 | Lens-rail `.72/.62` fill fails AA for `.cnt` at the rim; E3 worst-case column papered over two fills | **Must-fix — ACCEPTED.** Rail raised to `.85/.78` (`.cnt` ≥ 4.6:1, label ≥ 7.5:1, still visibly lighter than the slab); E3 row split into slab and lens-rail floors so the tier rule starts from true premises. | §3.1.j, §1.2, §5.3 |
| R15 | `#ritual` violates WCAG 2.5.3 (visible "ritual"/"rapid" not in accessible name "Casting speed") + mixed toggle idioms | **Must-fix — ACCEPTED (idiom A).** `#ritual` is a mode-swap button: no `aria-pressed`; `setRapid` swaps `textContent` AND `aria-label` "Casting: ritual"/"Casting: rapid" (visible word contained). Two idioms now explicitly documented (§2.12); touch-confirmation re-keyed to `data-tip-live` (§2.13). | §2.12/2.13, §3.2.e/g, Stage 4 exit |
| R16 | Grimoire sub-line renders "+12 more" on a 12-item hoard | **Must-fix — ACCEPTED.** `N = children.length − 3`, omitted when ≤ 0; "+9 more for k=12" exit check added. | §3.3.h, Stage 5 exit |
| R17 | Tooltip permanently `aria-hidden="true"` while visibly rendered | **ACCEPTED.** show/hide flips `aria-hidden`; symmetric exit check. | §3.2.a, Stage 4 exit |
| R18 | No scroll dismissal — stale tip over `.tabpanel` slot-randomizers | **ACCEPTED.** Document-level capture passive scroll listener hides the tip (guarded on visible state). | §3.2.a, Stage 4 exit |
| R19 | Cap flag (⊘) loses its text equivalent at manifest level; badge aria-hidden trap | **ACCEPTED.** sr-only " · reroll cap reached" on cap rows; explicit rule that the manifest `.count-badge` is NOT aria-hidden (unlike the headline's at result.js:135). | §3.3.e, Stage 5 exit |
| R20 | "gold ≥ 11:1 on every tier" arithmetically unattainable (boosted teal ≈10.0:1) | **ACCEPTED.** Invariant restated as **≥ 9.5:1** (real floor with margin; §5.3's active-tab 8.5:1 check unchanged); teal-blob-is-binding note added to the tier rule so future math starts from truth. | §0, §1.2 |
| R21 | Copy vs export hoard formats diverge | **ACCEPTED.** Shared `EM.hoardBlock(root)` used by both `resultToText` and `doExport`; identical-output exit check. | §3.3.c/h, Stage 5 exit |
| R22 | (a) `countKinds` needs a `Set`, spec showed an object; (b) mani-all mixed-state rule unstated | **ACCEPTED.** (a) Calls written as `new Set([...])`; (b) rule: "Collapse all traces" iff every head expanded, else "Expand all traces"; mixed-state exit check added. | §3.3.d, Stage 5 exit |

---

## 7. Non-Goals (explicitly out of scope)

1. **No hoard star-chart** (DESIGN.md bell 12), no copy-as-image (13), no "Focus the eyepiece" (14), no cursed cosmic event (15) — the manifest supersedes bell 12's direction; DESIGN.md updated accordingly.
2. **No engine behavior changes** beyond the additive `summary` field — roll math, determinism, table data, page data untouched (the page-number review track is a separate effort).
3. **No desktop (Tkinter) changes** in this pass — parity port is a documented follow-up.
4. **No library.js changes** — virtualization, ROW_H, sort, search, row markup all untouched; library legibility is pure CSS.
5. **No new dependencies, modules, or build tooling** — one new classic script, inlined by the existing build.py.
6. **No tab markup or tablist-a11y changes** — rail work is CSS-only.
7. **No constellation drift wrap fix** (pre-existing; cheap follow-up if a rim figure walks inboard over very long sessions).
8. **No `user-select:text` on manifest rows** (whole-row buttons preclude drag-select; mitigated by manifest-led Copy — revisit only if users complain).
9. **No hoverable-tooltip variant** (documented 1.4.13 tradeoff — see DESIGN.md a11y notes).
10. **No changes to** splash, supernova, toast, palette behavior, seed sigils, die badges, or the audio engine.

---

## 8. Consolidated Risk Register (top items, with pre-agreed escape hatches)

| Risk | Hatch |
|---|---|
| E2 panels read flat at .82/.90 | boost `.28 → .26`; never lower fills below .82 |
| Top band reads as empty black stripe (bloom + scrim + plaques) | rail scrim `--surf-veil` `.45 → .30` first; vignette bloom second; never fieldGain |
| Retina blit change invalidates all old screenshots | expected — verify dot/twinkle alignment at dpr 1 & 2 instead |
| PAD offset inconsistency across 4 paint paths | smoke test: reduce-effects ON vs OFF star positions identical |
| `lvh` fallback engines still rebuild on URL-bar transitions | accepted degradation (matches today, debounced); do not add UA sniffing |
| Grimoire-open shifts content off ellipse center (1024–1280px worst) | shift ellipse center x to 0.46 viewport |
| moveArc drift from new tab padding/borders | existing rAF + resize re-measure; visual check at 320/2000px |
| Header overflow at 901–1023px | hide `.hdr-sep` ≤1023 and/or pill padding `2px 4px` |
| Header still tight at 320px despite §3.2.i | drop the dropcap glyph ≤360px (decorative); never shrink buttons |
| Sticky lib-head ghosting (.96 over .93) | `.lib-head` → `var(--glass-solid)` |
| Lens rail at .85/.78 reads too close to the slab | drop rail bottom stop to `.72` only if `.cnt` is also moved to `--mist-bright` (keep the 4.5:1 floor either way) |
| Expand-all on k≥30 mounts k trees in one frame | acceptable at current K ranges; chunk across rAF only if a stress hoard materializes |
| Hoard copy-text format change | intentional; non-hoard copies byte-identical (traceLines untouched); Copy ≡ Export via `EM.hoardBlock` |
| `{el, order, stagger}` contract mismatch silently kills reveal audio | contract test in Stage 5 exit criteria |
| Future edits raising boost/blob saturation break tier AA | tier rule + math (teal-core binding case) documented in DESIGN.md §2 |
