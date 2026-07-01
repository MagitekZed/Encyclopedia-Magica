My decision: lead with **Astral Observatory** (both data-density judges scored it highest — 96/90 — and light-on-dark jewel-UI is the correct substrate for a 5,709-row table and depth-6 trace tree), but graft in the two most valuable pieces the panel converged on: **Arcane Runeworks' directional "ignition cascade"** trace animation and node-kind color discipline (the clearest rendering of the RollStep tree), and **The Living Grimoire's already-embedded font stack** (Cinzel + Cinzel Decorative + EB Garamond are sitting in `web/fonts.css` — no re-fetch, keeps the single-file promise cheap) plus its category-glyph illumination and warm gap-framing. Universal grafts: seed sigil + permalink, command palette, Ritual/Rapid toggle, copy-as-image, natural-max easter egg.

Here is the complete design system.

```markdown
# DESIGN.md — Encyclopedia Magica Roller (Web)
### "Astral Observatory" — a single-file arcane dice instrument

> **Primary direction:** Astral Observatory (deep-space jewel-UI, light-on-dark).
> **Grafted in:** Arcane Runeworks' *directional ignition-cascade* trace animation + node-kind
> color discipline; The Living Grimoire's *already-embedded font stack*, category-glyph
> illumination, and warm "calm banner" gap-framing; universal seed-sigil / permalink /
> command-palette / Rapid-mode / copy-as-image grafts.
> **Ships as:** ONE static HTML file (inline CSS + JS + `window.EM_DATA` ~1.15 MB + base64 fonts),
> openable by double-click (`file://`) and servable. Vanilla JS. No runtime framework.

The engine is already ported in `web/js/` (`rng.js`, `ranges.js`, `format.js`, `dataset.js`,
`engine.js`, `selftest.js`) and returns a `RollStep` **trace tree** exactly as specced. This
document defines the *presentation layer* that renders it. Do not re-implement roll mechanics here —
consume `RollResult { kind, headline, root: RollStep, seed }` and render.

---

## 1. Concept & Mood

You are at the eyepiece of a great brass-and-obsidian telescope at the edge of the world, charting
magic instead of stars. The app is a precise, jewel-like **astral instrument**: near-black indigo
voids lit by aurora, gold constellation-lines, and cool starlight — hushed, luxurious, faintly sacred,
the planetarium moment before the show. Every roll resolves *like a star coming into focus*, and its
explanation — the master→category→type/bonus/item→cascade trace — draws itself across the result as a
living **constellation**, then reappears as that roll's unique **sigil** in the Grimoire. The mechanics
ARE the art: the "explain this roll" tree is the signature visual. Sci-fantasy, not dusty-tome —
this deliberately dodges parchment kitsch so a 5,709-row table and a depth-6 trace stay calm and
legible on the ideal light-on-dark substrate. Restrained at rest; incandescent for ~800 ms on the roll.

---

## 2. Color Tokens

All colors are CSS custom properties on `:root`. Hex is authoritative; `rgba()` given where alpha is
part of the token.

```css
:root {
  /* ---- Voids & surfaces ---- */
  --void:          #05060E;  /* app background, deepest starfield layer */
  --void-2:        #0A0D1C;  /* vignette bloom center behind panels */
  --abyss:         #111634;  /* panel base tint under the glass */
  --glass-fill-a:  rgba(17,22,52,.62); /* panel gradient stop A */
  --glass-fill-b:  rgba(10,13,28,.72); /* panel gradient stop B */
  --glass-stroke:  #2A3566;  /* default 1px panel/border stroke (cool slate-indigo) */
  --glass-solid:   #0E1226;  /* OPAQUE fallback fill when backdrop-filter unsupported */

  /* ---- Arcane accents ---- */
  --nebula-violet: #6E4CD8;  /* primary arcane hue; artifact-power accent; selection glow */
  --nebula-magenta:#B14AE0;  /* reroll/cascade energy; aurora hot stop */
  --aurora-teal:   #2FD8C4;  /* success / "filled page" / d10 badge / cyan edge-light */
  --astral-blue:   #4CA6FF;  /* constellation-line default; links; focus rings; d1000 badge */

  /* ---- Luxe gold (THE accent) ---- */
  --gold:          #E9C46A;  /* Cinzel headings, active filigree, primary rim, pinned entries */
  --gold-bright:   #FBE7A8;  /* specular hit / ignition flash / lock-flash */
  --gold-deep:     #8A6A2E;  /* dormant filigree (unlit constellation stroke at rest) */

  /* ---- Text ---- */
  --star-white:    #EAF0FF;  /* primary text (blue-cool white) */
  --mist:          #9AA6C8;  /* secondary/muted: table ids, die labels, metadata */
  --mist-faint:    #5A6B8C;  /* tertiary: "not in index", disabled, hairline separators */

  /* ---- Semantic ---- */
  --rose-warn:     #FF6B8A;  /* cursed (-1), reroll-cap leaf, validation errors, data gaps */
  --lime-ok:       #8CE0A0;  /* rare success confirm (copy done) — used sparingly */

  /* ---- Die-family tints (badge + trace nodes) ---- */
  --die-d1000:     var(--astral-blue);
  --die-d100:      var(--nebula-violet);
  --die-d20:       var(--gold);
  --die-d10:       var(--aurora-teal);

  /* ---- Node-kind tints (grafted from Arcane Runeworks' discipline) ---- */
  --kind-roll:        var(--astral-blue);
  --kind-reroll:      var(--nebula-magenta);
  --kind-enhancement: var(--nebula-violet);
  --kind-assembly:    var(--gold);
  --kind-cap:         var(--rose-warn);
  --kind-gap:         var(--rose-warn);

  /* ---- Edges / glows ---- */
  --edge-hair:  rgba(234,240,255,.06);      /* inset top-sheen on glass */
  --shadow-drop: 0 20px 60px rgba(0,0,0,.55);
}
```

**Contrast check (must pass ≥ 4.5:1 body / 3:1 large):** `--star-white` on `--abyss` ≈ 13:1 ✓ ·
`--mist` on `--abyss` ≈ 6.3:1 ✓ · `--gold` on `--abyss` ≈ 7.4:1 ✓ · `--mist-faint` on `--abyss` ≈ 3.1:1
— **use `--mist-faint` for large/decorative text only, never body copy.** Rose/teal/violet accents are
paired with a glyph or shape, never color-alone, for colorblind safety (see §8 node kinds).

---

## 3. Typography

**Reuse the fonts already base64-embedded in `web/fonts.css` (9 `@font-face` blocks) — do NOT re-fetch.**
Available embedded: **Cinzel**, **Cinzel Decorative**, **EB Garamond**. For the monospace machinery layer
we do **not** ship a fourth embedded family (keeps payload lean); use a robust system mono stack with
`font-feature-settings:"tnum" 1` so digit columns stay aligned.

| Role | Family | Weights | Usage | Sizing |
|---|---|---|---|---|
| **Display / ceremony** | `Cinzel` | 600, 700 | app wordmark, tab labels, result headlines, section titles, die-badge numerals | H1 28–30px, headline 24–26px, tab 14px; `letter-spacing:.06em`; **never < 12px** |
| **Illuminated flourish** | `Cinzel Decorative` | 700 | the wordmark's drop-cap only, hoard "star-chart" title, sparingly | 32–40px |
| **Prose / reading** | `EB Garamond` | 400, 400i, 600 | item names, power descriptions, trace labels, grimoire copy, library Name cells, banner copy | body 15px/1.55, trace label 14px; italic for read-aloud item names & notes |
| **Machinery / numerals** | `ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, monospace` | 400, 500 | every die number, roll range `001–491`, seed `seed 4127 · #12`, table id `R1 / S3 / 1-16`, trace scaffolding, library Roll column | 13px; `font-feature-settings:"tnum" 1,"zero" 1` |

**Rule of thumb:** Cinzel = ceremony (names/headlines/labels), EB Garamond = prose (what the item *is*),
mono = machinery (the numbers that produced it). Base type **15px / 1.55**. Small labels below 12px use
**letter-spaced uppercase mono**, never shrunken Cinzel. Set `text-rendering:optimizeLegibility` and cap
DPR at 2 on canvas so glyph edges stay crisp.

---

## 4. Animated Background — "the living cosmos"

One full-viewport `<canvas id="sky">` (`position:fixed; inset:0; z-index:-2; pointer-events:none`) plus a
CSS aurora layer (`z-index:-1`). All GPU-cheap; **restrained at rest** (see the Runeworks philosophy —
heavy light only fires on a roll).

1. **Starfield (canvas, offscreen-prerendered).** ~900 stars generated **once** into an offscreen canvas
   at three depths. Per frame, only the twinkle is recomputed: each star has a base alpha + slow sinusoidal
   twinkle (`0.2–0.6 Hz`, per-star phase offset). This is the *only* per-star per-frame work → holds 60 fps.
   On `pointermove` the three depth layers translate a few px in **damped parallax** (lerp toward target,
   `pointerX/Y` normalized). Throttle pointer to rAF.

2. **Drifting constellations (canvas, deepest layer).** ~6 pre-seeded constellations (nodes + lines) drift
   very slowly across the field; lines at **6–10% `--gold`/`--astral-blue` alpha** so they read as faint
   astral geometry, not decoration.

3. **Aurora / nebula (CSS only).** 2–3 huge blurred radial-gradient blobs
   (`--nebula-violet → --nebula-magenta → transparent`, and one `--aurora-teal`) at **~14% opacity**, each
   on a 40–70 s `@keyframes` drift+scale, `mix-blend-mode:screen`, `filter:blur(80px)`. Living color without
   touching the canvas.

4. **Vignette (CSS).** A fixed radial `--void → transparent` from center + a subtle top-edge `--void-2` bloom
   keeps text-bearing panels legible.

**Reactivity (nice-to-have):** idle = slow teal/violet drift; during a cast the nebula briefly saturates and
quickens (`--aurora-boost` class on `<body>` for ~600 ms), then eases back — *the sky reacts to the dice*.
A **cursed/-1 result** triggers a brief red-shift ripple + faint "eclipse" shadow over the card.

**Performance & motion guardrails (mandatory):**
- Cap `devicePixelRatio` at 2.
- Pause the rAF loop on `document.hidden` (`visibilitychange`); resume on focus.
- Auto-throttle: if rAF Δ implies < 45 fps for ~1 s, halve star count and disable parallax.
- `prefers-reduced-motion: reduce` **or** the in-app "Reduce effects" toggle → render a **static** starfield
  (single paint, no twinkle/drift), keep the still nebula, freeze aurora keyframes.
- `backdrop-filter` feature-detect (§6) gates the glass look; the canvas/aurora always render.

---

## 5. Layout — 4-Tab Shell + Header + Grimoire Sidebar

```
┌───────────────────────────────────────────────────────────────────────────┐
│  HEADER (fixed, glass rail)                                                 │
│  ✦ ENCYCLOPEDIA MAGICA   [🎲 Random Item]   seed ⟳[____] 🔒 #12   [⌘K] [♪] [⚙]│
├──────────────────────────────────────────────────────┬──────────────────────┤
│  TAB RAIL (astrolabe rail): ⟨Random⟩ ⟨Single⟩ ⟨Artifacts⟩ ⟨Library⟩          │  GRIMOIRE (Ctrl+H)   │
│  ─── gold underline-arc slides under active tab ───                          │  ▸ 📌 Boss's Sword    │
│                                                                              │  ▸ Hoard ×30          │
│   ┌── active tab body (ResultView / Library) ─────────────────────────────┐ │  › Potion of Flying   │
│   │  RESULT CARD (obsidian glass, constellation filigree)                 │ │  › +2 Long Sword …    │
│   │   headline ·  trace tree (the constellation)                          │ │  ──────────────────   │
│   └───────────────────────────────────────────────────────────────────────┘ │  [Copy][Export▾][Clr] │
└──────────────────────────────────────────────────────┴──────────────────────┘
```

- **Shell:** CSS grid. Header (fixed 56px) / body (`1fr`) / optional right sidebar (`clamp(280px, 24vw, 360px)`).
  Body max-width `min(1120px, 100% - sidebar)`, centered, 24px gutters.
- **Header** (glass rail, always on top): wordmark left (Cinzel + a single Cinzel Decorative drop-cap ✦);
  persistent **🎲 Random Item** astrolabe button (works from any tab); **seed field** with a ⟳ lock toggle and
  a mono `#N` position indicator; **⌘K** command palette; **♪** sound toggle (muted default);
  **⚙** Diagnostics (opens the `selftest.js` report as an in-world "star-chart anomalies" list).
- **Tabs** = horizontal glass chips on an engraved astrolabe rail. Opens on **Random Item** (the primary verb).
  Active tab: lit gold filigree + a thin gold **underline-arc** (slice of a circle) that slides between tabs
  with a spring on switch. Keyboard: `1–4` switch tabs.
- **Grimoire sidebar** (§ history): collapsible (`Ctrl+H`), slides in/out with a damped transform. On narrow
  viewports it becomes an overlay drawer.
- **Tab bodies:**
  - **Random Item** — one prominent Roll button + shared ResultView; **Treasure Hoard** control (K spinner +
    "Roll Hoard") lives here. Master-gap → calm banner (§7 result-reveal), never a dead end.
  - **Single Table** — grouped custom combobox (Item Tables A–T · Full Armor (R) · Full Weapon (S) ·
    Armor parts R1/R2/R3 · Weapon parts S1/S2/S3 · Artifact Powers 1-00…1-24) + **DieBadge** + Roll button.
  - **Artifacts** — Single Power (combo or 🎲 Random table + Roll Power); Generate Artifact (validated N
    spinner, radio Random/Choose → N per-slot combos each defaulting 🎲 Random, "Major/Minor mix" preset).
  - **Library** — the Star Catalog (§9).

---

## 6. Component Specs

### Panels / cards — "obsidian glass with gold constellation filigree"
```css
.panel{
  background: linear-gradient(150deg, var(--glass-fill-a), var(--glass-fill-b));
  backdrop-filter: blur(14px) saturate(120%);
  border: 1px solid var(--glass-stroke);
  border-radius: 16px;
  box-shadow: var(--shadow-drop), inset 0 1px 0 var(--edge-hair);
  padding: 22px;
}
/* Fallback when backdrop-filter unsupported (feature-detect, see below) */
.no-backdrop .panel{ background: var(--glass-solid); }
```
- **Feature-detect** once at boot: `if(!CSS.supports('backdrop-filter','blur(1px)') && !CSS.supports('-webkit-backdrop-filter','blur(1px)')) document.documentElement.classList.add('no-backdrop');`
  → panels fall back to opaque `--glass-solid` (never transparent unreadable rectangles).
- **Constellation filigree:** each panel border is an inline SVG overlay — thin `--gold-deep` strokes tracing
  the corners into small 4-point star-node caps, ~30% opacity at rest. On hover/focus/active it **ignites**:
  `stroke-dashoffset` animates a pulse of `--gold-bright` once along the path, settling to full `--gold` +
  soft outer glow. Active tab / selected slot keeps a persistent faint gold aura. Pure SVG stroke animation →
  GPU-cheap; the app feels alive to the cursor with almost no JS.
- Cap **simultaneously-blurring surfaces**: at most the ResultView + tab body + header + grimoire use
  `backdrop-filter` at once; library rows and trace nodes use flat `--abyss` tints, not blur.

### Buttons
- **Primary "Roll" (astrolabe button):** pill, obsidian-glass fill, full gold filigree rim, a small rotating
  astrolabe/reticle glyph on the left idling ~4°/s. **Right side always carries a mono DieBadge** showing what
  will roll. Hover: raise 2px + bloom a `--gold`/`--nebula-violet` radial glow beneath + reticle spins up.
  Press: dip 1px + bright rim pulse → triggers the cast (§7).
- **Secondary (ghost pills):** transparent fill, `--glass-stroke` border → `--astral-blue` + faint blue glow on
  hover. Mono/Cinzel-small labels: `Reroll (new seed)` ⟳ · `Replay (same seed)` ↺ · `Copy` · `Export ▾` ·
  `← Previous`.
- Every interactive element: `:focus-visible` → **2px `--astral-blue` ring, 3px offset glow**. Min hit target 40×40.

### Combobox / select (custom, `file://`-safe)
Native `<select>` is styled for the small pickers; the **big table pickers** use a custom dark-glass dropdown
panel (`role="listbox"`, `aria-activedescendant`, full arrow-key + type-ahead + Home/End + Esc). `--astral-blue`
focus ring; the selected row lights its filigree. **Changing the Single-Table selection re-forges the DieBadge**
(morph its polyhedron silhouette, §die-badge) so the die change is *felt*, not just read.

### Die badge
Small glyph beside every roll control and inside every trace node. Silhouette + tint encode the die:
- **d1000 / d100** → hexagon; **d20** → icosa/pentagon; **d10** → teardrop (pentagonal-trapezohedron hint).
- Tint: d1000 `--astral-blue`, d100 `--nebula-violet`, d20 `--gold`, d10 `--aurora-teal`; mono numerals, soft
  inner glow. On table-selection change it **morphs shape via `clip-path`** and pulses once.
- Zero-pad d1000 rolls to 3 digits (`000`), d100 to 2 (`00`) — display only, via `format.js`.

### Spinners (N powers, hoard K) — "dial inputs"
Mono value flanked by ▲▼ that glow `--aurora-teal` on hover. `validatecommand` equivalent: allow empty-or-digits
while typing; on blur/Enter coerce empty→min. Invalid (N<1 / non-numeric) pulses a `--rose-warn` border and
disables the action button inline. N > 20 → inline muted "large artifact" note, still allowed.

---

## 7. Dice-Roll Animation & Result Reveal

A three-beat choreography, **~750 ms**, tuned to "consulting an instrument," not a casino. **Fully driven by the
RNG sequence and interruptible** — a second Roll / `Space` / `Enter` snaps the prior to its final state and starts
fresh (fast play never queues). A **Ritual / Rapid** toggle and `prefers-reduced-motion` both collapse this to a
**~120 ms cross-fade** with just the gold lock-flash.

**BEAT 1 — Wind-up (0–150 ms):** pressed Roll button's reticle spins up; a faint ring of light contracts inward
toward the button; `<body>` gets `.aurora-boost`.

**BEAT 2 — The Cast (150–500 ms):** a single stylized die materializes center-of-result as a glowing wireframe,
tumbling with a CSS 3D transform (`rotateX/Y`), faces flickering random numbers in mono (swap ~55 ms),
decelerating on `--ease-out-expo`, trailing a short `--nebula-violet` motion-blur streak. **Per die type:**
- **d20** → icosahedron; faces flicker 1–20.
- **d100 / d1000** → a percentile pair of glowing rings with scrolling digits (a physical d1000 polyhedron is
  silly); flicker respects the die max — a d20 never flashes 74, a d100 never flashes 000.
- **d10** → pentagonal-trapezohedron; flicker 1–10 (0 shown as 10/00 per table).

**BEAT 3 — Resolve (500–750 ms):** die snaps flat to the final face; the number **locks** with a `--gold-bright`
flash + a ring-shockwave that expands and fades; 4–6 tiny star particles spark off and drift up. The final number
flies up into the trace tree's root row as that row draws in.

**Multi-roll casts** (R/S assembly type+bonus+item, artifacts N-powers, hoards K) **stagger each sub-die by
~120 ms** so you watch the constellation build node by node — each sub-die's max respected independently.

**Result reveal — "resolves into focus like a star in a telescope":**
- The headline zone starts slightly `blur(6px)` + dim; as the die locks it sharpens (`filter:blur→0` + opacity)
  over ~350 ms while a horizontal `--gold-bright` sweep passes L→R across the Cinzel headline (specular glint on
  engraved metal).
- Assembled name (`+2 Long Sword of Speed`) in Cinzel, numeric bonus in `--gold`; a compact mono count badge
  (`· +2 combined (1 enchanted)`) fades in beside it.
- A **category-glyph** (grafted from Grimoire) stamps in the card's top corner — a small constellation-style
  monochrome sigil auto-picked from `RollStep`/item category (flask=liquids, scroll=scrolls, ring, blade=weapons,
  radiant=artifact, etc.) — instant item-type legibility without color-only coding.
- Page ref → mono chip: `filled` = teal-dotted `(p.341)`; `not_in_index` = muted `--mist` "not in index";
  `n/a` = omitted.
- A hairline gold divider draws L→R, then the **trace tree grows** (§8).
- Footer instrument-strip (`seed 4127 · #12`, action pills) slides up last.
- **Cursed / -1:** headline underline + lock-flash go `--rose-warn`; the cosmic red-shift ripple fires.
- **Master-gap / cap / data-gap = NOT an error** (grafted Grimoire warmth): a calm aurora-tinted banner with the
  same visual weight as a normal result — explanatory copy + inline `[ Category ▾ ]` + `[ Reroll 1–{hi} ]` for
  master-gap; a "sealed" rose leaf for cap; a hollow dashed rose node + note for data-gap.

**Motion tokens:** `--dur-cast:750ms; --dur-reveal:350ms; --stagger:120ms;
--ease-out-expo:cubic-bezier(.16,1,.3,1); --ease-spring:cubic-bezier(.34,1.56,.64,1)`.

---

## 8. THE TRACE TREE — signature feature (constellation × ignition-cascade)

The `RollStep` tree rendered as a **living constellation map** whose links **ignite in strict parent→child order**
(the Arcane Runeworks graft) so you *watch the roll flow* master → target → type/bonus/item → cascade, top-down.
This is the killer feature; it is also the aesthetic payload.

**Structure.** SVG + DOM hybrid (crisp lines, copyable text). Each `RollStep` is a **star-node** row on a vertical
spine; children indent one "orbit" right, connected by an elbow **constellation-line** (SVG path). Node row anatomy:

```
[★ node]  [DieBadge]  d1000 → 604   ⟶   Long Sword          (p.341)   ↳ italic note
 └ kind    tint         mono id+roll      EB Garamond label   page chip   --mist note
```

**Ignition sequence (grafted, mandatory for the signature feel):** on reveal, the root node lights first; then its
connector **fills** via `stroke-dashoffset` (a `--gold` pulse running the path) down to the child, which then
lights — staggered `--stagger` per node, in the exact order the engine nested them. So the abstract tree becomes a
visible celestial map of *how the item came to be*. Interruptible; instant-draw under reduced-motion/Rapid.

**Node kinds — shape + tint + glyph (never color-alone):**

| `RollStep.kind` | Node shape | Tint | Glyph | Connector |
|---|---|---|---|---|
| `roll` | small filled star-dot | `--kind-roll` (astral-blue) | — | gold pulse |
| `reroll` | dot inside a halo | `--kind-reroll` (magenta) | `⟳` | **magenta** pulse |
| `enhancement` | 4-point sparkle | `--kind-enhancement` (violet) | `✦` | violet pulse |
| `assembly` (armor/weapon/artifact root) | larger gold node | `--kind-assembly` (gold) | ⬡ | gold, fuses 3 siblings into one junction |
| `cap` (`reroll cap reached`) | rose node w/ faint "sealed" ring | `--kind-cap` (rose) | 🔒 | rose, terminates |
| `gap` (data hole / no entry) | **hollow dashed** rose node | `--kind-gap` (rose) | ◌ | dashed rose |

- **R/S assembly** shows three sibling conduits (type / bonus / item) fusing into one gold junction carrying the
  assembled headline. The R1 catch-all "Special → R3" collapse is rendered per engine (type node marked
  informational via its `note`).
- **Nearest-range** (R1@576) & **power-hole** notes render as an italic `--mist` gloss under the node.
- Full R2 label (`AC Adj +1 / XP +500 / GP +5,000`) lives in the node label + hover tooltip; headline shows only
  the extracted `+2`.

**Interaction.**
- **Collapsible:** click a parent to fold its subtree into the star — the constellation contracts with `--ease-spring`.
- **Collapse-to-headline** toggle folds everything to the root for at-the-table play; expand for the DM view.
- **Hover** a node → it lifts, brightens its links, traces the path back to the root, and shows a tooltip with full
  detail (full bonus string, page status, roll range).
- **Copy/Export** serializes to indented ASCII (`└`/`↳`) matching the spec's example — the tree copies/exports cleanly.
- **Hoard (K items):** each item is its own **small collapsed constellation** under a grouped parent so a 30-item
  panel doesn't explode; expand any one to see its cascade.

---

## 9. Library — "The Star Catalog" (5,709 rows)

- **Layout:** left rail of table "lenses" (A–T, R/S parts, 1-00…1-24) as glass chips with die badge + item count;
  selecting one filters + gently pans a faint constellation motif behind the table.
- **Table (virtualized — non-negotiable):** windowed rendering, only ~40 visible rows in the DOM, recycled on
  scroll, so 5,709 rows sort/scroll at 60 fps on `file://`. Columns **Table · Roll · Name · Page · Reroll?**,
  sortable by header (click cycles asc/desc with a gold ▲/▼ + arc-underline on the active column). Sticky engraved
  header rail.
- **Row styling:** zebra via alternating 3%/6% white overlays (no hard lines). Roll ranges + Table id in mono;
  Name in EB Garamond; Table cell carries a tiny die-family color chip. `reroll:true` → a magenta `⟳` sigil in
  Reroll? + a faint magenta left-edge tick; the 19 **Enchanted Enhancements** get a violet `✦`. `not_in_index`
  page → muted `—`.
- **Search (reticle/eyepiece):** magnifier glyph, teal focus glow, **debounced ~150 ms**, token-**AND** across
  `name + category + table + subcategory + page` (matches spec). Mono count `37 of 5,709`; `Esc` clears; matched
  query tokens get a subtle `--gold` underline highlight in the Name cell.
- **Empty state:** a lone dim star + `No items match "xyz" — clear (Esc)`.
- **Double-click a row →** glass detail popover (what this roll yields, full page/status, roll range) with a
  **"Roll this table →"** action that jumps to Single Table pre-selected.

---

## 10. Sound Design (synthesized WebAudio)

Single `AudioContext`, **muted by default**, lazily unlocked on first user gesture (autoplay-policy safe),
feature-detected, `try/catch`-wrapped so a blocked context never breaks rolling. Global volume + mute persisted
to `localStorage`. Tuned to a **pentatonic** scale so rapid rolls never clash; one shared feedback-delay/convolver
"cathedral-of-space" reverb bus glues everything.

| Event | Sound |
|---|---|
| Roll wind-up | soft filtered-noise whoosh + rising sine sweep 200→600 Hz |
| Die ticks | very short quiet FM "tick" bursts per face-flicker, thinning as it decelerates (audio ease-out matches visual) |
| Resolve / lock | bright bell — two detuned sines + a triangle, short attack, long shimmer release; **pitched by die** (higher d20, deep resonant pair d100/d1000) |
| Cascade node | each combine plays the next note **up a pentatonic run** → a 3-deep cascade arpeggiates a rising phrase (you *hear* the constellation build) |
| Cursed / cap / gap | detuned minor-second dissonant chime instead of the bright bell |
| UI | near-inaudible glassy "tink" on tab switch; filigree-ignite = faint airy shimmer; grimoire-pin = warm two-note confirm |
| Natural max (easter egg) | `d20→20 / d100→00 / d1000→000` → a brief bright "supernova" three-note gold arpeggio |

---

## 11. Signature Effects & Browser-Only Bells (prioritized)

**MUST-HAVE (core identity / spec parity / perf):**
1. **The Orrery of Results** — the trace tree draws itself as a constellation with the **directional ignition
   cascade**; the finished roll is a small unique constellation. *This is the app's signature.*
2. **Virtualized Library** — windowed 5,709-row render. (Perf-critical; the one non-negotiable.)
3. **RNG-driven, interruptible reveal** + **Ritual/Rapid toggle** + `prefers-reduced-motion` path.
4. **Deterministic seed sigil** — a small procedural SVG glyph from `seed + roll#`; same seed → identical sigil;
   used as each Grimoire entry's avatar. (The constellation shape itself is seeded, doubling as the sigil.)
5. **Seed permalink + Replay** — encode `seed + roll sequence` in the URL hash (`#s=4127`); "copy link"
   reproduces the exact session (works from a double-clicked `file://` reopen); Replay scrubs the sequence.
6. **Filigree-ignite hover** on every glass panel (pure SVG stroke-dashoffset, GPU-cheap).
7. **`backdrop-filter` fallback** + DPR cap + `visibilitychange` pause + fps auto-throttle + "Reduce effects" toggle.
8. **Grimoire** persistence (localStorage, `try/catch` → in-memory fallback), pin/label, hoard grouping.
9. **Copy / Export** result & hoard to `.txt` / `.md` / `.json` (headline + indented trace + seed → replayable file).

**NICE-TO-HAVE (delight, add after core is solid):**
10. **Command palette (Ctrl+K / ⌘K)** — glassy astral search to jump to any table, roll it, or run any action by name.
11. **Full keyboard set** + `?` cheatsheet overlay: `R`/`Space` roll (scoped off text fields, no-op on Library),
    `Ctrl+R` reroll, `Ctrl+Z` previous, `1–4` tabs, `Ctrl+F` search, `Ctrl+H` grimoire, `Esc` clear.
12. **Treasure Hoard as a star-chart** — mini-constellations laid across a zoom/pan night-sky grid; export the whole
    chart as grouped stat blocks.
13. **Copy-as-image** — render the result card/constellation to canvas (`toDataURL`) → paste the sigil into Discord/notes.
14. **"Focus the eyepiece"** — on a fresh roll the starfield darkens and the nebula pulls toward the card ~600 ms
    (telescope racking focus), then relaxes.
15. **Cursed cosmic event** — red-shift ripple + eclipse shadow on a -1/cursed result.
16. **Natural-max supernova** easter egg (visual burst + the §10 chime).
17. **Aurora reactivity** — nebula saturates/quickens during a cast.
18. **Diagnostics as "star-chart anomalies"** — `selftest.js` / data-warnings (R1@576, 1-16@37) rendered as
    themed, copyable tickets in the ⚙ panel.

---

## 12. Motion, Micro-interactions, States, Responsive, A11y

**Easing / duration tokens (§7 restated as the canonical set):**
```css
--ease-out-expo: cubic-bezier(.16,1,.3,1);   /* die decel, reveals, panel lifts */
--ease-spring:   cubic-bezier(.34,1.56,.64,1);/* tab arc slide, node collapse */
--dur-fast:120ms; --dur-base:220ms; --dur-reveal:350ms; --dur-cast:750ms; --stagger:120ms;
```

**Micro-interactions:** buttons raise 2px on hover / dip 1px on press; tab underline-arc springs; filigree ignites
on hover/focus; DieBadge morphs on selection change; grimoire entries glow + trace a line back up the timeline on
hover; copy → a brief `--lime-ok` "copied" pulse; inline validation pulses `--rose-warn`.

**Loading state:** the ~1.15 MB `EM_DATA` + selftest parse can block first paint. Show a **1-shot "aperture opening"**
splash (a dim star that resolves into focus) while data parses on a `requestIdleCallback`/`setTimeout(0)` after first
paint; reveal the shell when `EM_DATA` is ready. Fonts are inline (no FOUT), but guard with a system-serif/mono
fallback if a base64 decode fails.

**Empty states:** Library empty (§9); Grimoire empty → dim illustration line "The log is empty — cast a roll to
inscribe it."; master-gap / cap / data-gap → calm banners (§7), **never** red error dialogs.

**Responsive:**
- ≥ 1024px: full 3-column shell (body + sidebar).
- 640–1023px: Grimoire becomes an overlay drawer (`Ctrl+H` / toggle); tab rail stays; body full-width.
- < 640px: single column; tab rail scrolls horizontally; result card full-bleed; trace tree indents collapse to a
  compact left-gutter; disable pointer-parallax and card tilt; reduce simultaneous blurs.
- Respect `env(safe-area-inset-*)`; min 40×40 hit targets.

**Accessibility (load-bearing, not optional):**
- **Reduced motion / effects:** honor `prefers-reduced-motion` AND ship a visible "Reduce effects" toggle; both
  freeze the starfield/aurora and collapse all reveal choreography to a cross-fade.
- **Focus rings:** every interactive element has a visible `:focus-visible` 2px `--astral-blue` ring (3px offset
  glow); never remove outlines without a replacement. Keyboard-only users can operate the entire app (tabs, roll,
  search, grimoire, custom comboboxes with arrow/type-ahead, command palette).
- **Contrast:** body text ≥ 4.5:1 (star-white/mist on abyss pass); `--mist-faint` restricted to large/decorative.
- **Color-independence:** every node kind, reroll flag, and die family pairs color with a **shape/glyph** (§8, §9)
  so nothing is conveyed by hue alone.
- **ARIA:** tabs = `role="tablist"/tab/tabpanel` with `aria-selected`; trace tree = `role="tree"/treeitem` with
  `aria-expanded` on collapsible nodes; Library = `role="grid"` with sortable `aria-sort` headers; live regions
  announce the result headline and Library result count (`aria-live="polite"`).
- **Sound** is opt-in and never required to understand a result.
- **Copy/Export** yields plain text so results are usable by screen readers and downstream tools.
```

---

**Key files this design consumes / aligns to** (all under `/Users/zach/Documents/Encyclopedia Magicka/`):
- `web/data.js` — `window.EM_DATA` (items[], master, mech, power tables, enhancement); ~1.15 MB, bundled inline.
- `web/fonts.css` — 9 base64 `@font-face` blocks: **Cinzel, Cinzel Decorative, EB Garamond** (reuse; no re-fetch).
- `web/js/` — `rng.js`, `ranges.js`, `format.js`, `dataset.js`, `engine.js`, `selftest.js` (the ported engine returning the `RollStep` trace tree this UI renders).
- Spec of record: `app/ROLLER_DESIGN.md` (§c algorithms, `RollStep`/`RollResult` shape, edge cases) and `app/BUILD_HANDOFF.md` (locked decisions, data facts).

**Chosen direction:** Astral Observatory (both data-density judges ranked it #1 at 96/90; light-on-dark is the right substrate for the dense table + deep trace). **Grafted:** Arcane Runeworks' directional ignition-cascade + node-kind color discipline into the trace tree (§8); The Living Grimoire's already-embedded fonts (§3), category-glyph illumination (§7) and calm gap-banner framing (§7); universal seed-sigil/permalink/command-palette/Rapid-toggle/copy-as-image grafts (§11).