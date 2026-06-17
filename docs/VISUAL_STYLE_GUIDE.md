# Visual Style Guide

Citizenship Valley uses a functional pixel-art prototype style. The goal is clarity first: players should recognise the region, spot interactive people and objects, and understand where learning activities live.

## Scale

- Logical tile size: `32px`.
- Render scale: `1.5x`, so visible tiles are `48px` on the canvas.
- Canvas: `1280x768`.
- Player/NPC sprites occupy a roughly `32x48` visual footprint.
- Keep world-space labels short because they render inside the scaled canvas.

## Region Palettes

Each region has a distinct `visual` palette in `WORLD`:

- Village: bright civic green, stone paths, warm civic buildings.
- Modern Britain: media blue, press red, market/city accents.
- Rights & Law: stone grey, legal purple, court gold.
- Democracy: parliament gold, ballot red, civic blue.
- Participation: harbour teal, campaign green, petition red.
- Action Workshop: planning green, data blue, toolkit amber.
- Exam Hall: castle purple, source blue, exam gold.

## Region Motifs

Every exterior region should have a readable motif near the main play route:

- Village: noticeboard, civic square, meadow detail.
- Modern Britain: newspaper kiosk, media board, market press signs.
- Rights & Law: court steps, rights aid signs, scales motif.
- Democracy: ballot booth, parliament steps, election posters.
- Participation: boats, petition banner, harbour piers.
- Action Workshop: planning board, data cards, campaign tools.
- Exam Hall: castle gate, exam desks, source archive.

## Asset Locations

- `assets/items/` contains the first small item PNG pass for starter/quest items, tools, consumables, and collectible rewards.
- `assets/ui/` contains seed UI marker assets, starting with the mini-game marker.
- `assets/props/region/` contains seed regional prop assets, starting with ballot-booth art.
- `assets/story/apathy-shade.svg` remains the dedicated Apathy Shade silhouette for story scenes.
- Mini-game trigger props now use PNG runtime assets under `assets/props/region/` with SVG source files beside them and canvas primitive fallback in `game.js`.
- Modern Britain currently uses a CSS-rendered `kiosk` prop as the first auditable newspaper/media stand in map data.
- Rights & Law currently uses CSS-rendered `scales` and `notice` props as auditable legal/court wayfinding objects in map data.
- Democracy currently uses CSS-rendered `ballotBox`, `podium`, and `poster` props as auditable election/debate wayfinding objects in map data.
- Participation Harbour currently uses CSS-rendered `petitionStand`, `boat`, and `banner` props as auditable harbour/campaign wayfinding objects in map data.
- Action Workshop currently uses CSS-rendered `planningBoard`, `surveyBox`, `dataCards`, and `campaignTable` props as auditable research/planning/campaign wayfinding objects in map data.
- Exam Hall Castle currently uses CSS-rendered `finalGate`, `examDesk`, `sourceArchive`, and `debateBench` props as auditable exam/source/final route objects in map data.

## Interaction Contrast

- Interactive doors use gold frames and dark interiors.
- Study stations use a saturated accent and label text.
- Exam practice rooms use gold cards and an `E` marker.
- Mini-game host NPCs use a floating `Game` marker above their sprite.
- The closest interactable still uses the contextual `E` prompt.
- Unresolved regions can show subtle Apathy Shade traces near their landmark until the related story flag is earned.

## Hero Presentation

- HUD and Character panel portraits should use the same visual profile as the canvas sprite.
- Presets should differ by hair style, outfit silhouette, shoe colour, backpack colour, and accent placement.
- Held tools should only appear when equipped.
- `Justice Quill` reads as a feather/quill silhouette; `Debate Blade` reads as a ceremonial debate tool.
- The current interactable target should be highlighted before the contextual `E` prompt appears.

## UI Status Colours

- Quest/story: gold.
- Mini-game: blue/cyan with gold trim.
- Shop/economy: green and gold.
- Warning/reset: red.
- Completed/success: green.
- Exam/final: purple and gold.

## Story And Mini-game Presentation

Current first pass: story scenes render regional title-card details with act label, landmark silhouette, key object label, Apathy Shade, and sparks. Mini-game panels use themed stage layouts, and completion screens show a medal/reward mark alongside text score feedback.

- Story title cards should identify the current region immediately through palette, landmark silhouette, Apathy Shade presence, and act title.
- Keep story cards compact and readable; do not let decorative art compete with the narrative text or action buttons.
- Mini-games should differ by layout pattern, not only by title text:
	- Source Detective: newspaper headline cards and reliable/unreliable stamps.
	- Rights Match: paired right/responsibility cards.
	- Petition Regatta: harbour route, boat, signatures, and misinformation hazards.
	- Ballot Count: ballot slips on a counting table.
	- Debate Arena: Argument/Evidence/Rebuttal/Empathy cards.
	- Campaign Planner: board layout with Research, Plan, Action, Evaluate stages.
	- Exam Simulation: exam paper, source extract, and answer planner.
- Completion screens should make medal quality visible with a small reward mark, while keeping score breakdown and learning feedback easy to scan.
- In-world mini-game host markers show dynamic status labels: New, Try, Bronze, Silver, or Gold.
- Explicit mini-game trigger props can carry `Play` markers with the same dynamic status labels when they define `miniGameId` in map data.
- Current trigger props cover all seven mini-games: kiosk, notice board, petition stand, ballot box, podium/debate bench, planning board, and exam desk.
- Progress mini-game cards should mirror map state by showing host, trigger location, and marker status.

## Item Presentation

- Quest items use a gold frame and show a locked marker because they cannot be sold.
- Consumables use a green frame and should surface their Focus/Knowledge effect clearly.
- Outfits use a blue frame and should indicate when they can be worn or are equipped.
- Tools use a silver frame and should describe their mini-game or exam assist.
- Collectible/treasure rewards use a teal frame.
- Backpack rows should support quick scanning, while the selected-item panel should show the larger thumbnail, type, stack/equipped state, lock state, description, effects, and actions.

## Rules For New Art

- Prefer small, inspectable bitmap/WebP assets when replacing placeholder art. SVG source assets are acceptable when the image needs to stay text-editable, but UI/item runtime replacements should prefer PNG/WebP.
- Keep item icons to a stable square size such as `32x32` or `48x48`.
- Keep contrast high enough to read against the current region palette.
- Avoid blocking paths with decorative props unless the validator is updated and passable routes remain clear.
- After map or visual changes, run `node scripts\validate-world.js` and `node qa-visual-smoke.mjs`.

---

# V2 2.5D Pixel-Art Spec (Stage 1)

This section is the authoritative brief for the V2 new-graphics overhaul (see `docs/PLAN_STAGE1_2_5D.md`). It governs every PNG asset produced for V2. Strategy is **hybrid**: the agent builds the engine + fallback + this spec; the user generates the key pixel art in an external AI editor; we iterate per asset.

## Lighting (global, fixed)

- **One light direction for the whole game: top-left.** In code this is `LIGHT_DIR = {x:-0.6, y:-0.8}` (Stage 1A). Every cast shadow falls down-right; lit faces are top/left, shaded faces are bottom/right.
- **Do NOT bake a cast (ground) shadow into any sprite** — the engine draws cast shadows via `drawCastShadow`. You MAY bake the object's own form shading (top-left lighter, bottom-right darker).
- Keep one consistent sun across tiles, trees, buildings, hero and NPCs so the scene reads as one space.

## Pixel scale (critical — read before drawing)

`RENDER_SCALE = 1.5` is **non-integer**: art authored at logical size and scaled ×1.5 by the engine looks blurry. So **author at display resolution = logical × 1.5** and the engine draws it 1:1.

| Asset | Logical size | **Author (PNG) size** | Pivot |
|---|---|---|---|
| Tile | 32×32 | **48×48** | none (grid) |
| Tree / tall billboard | ~64×96 | **96×144** | bottom-centre |
| Hero frame (later) | 32×48 cell | **48×72** | bottom-centre |
| Building facade (later) | per `kind` | footprint W×48 wide | bottom |

- Export crisp pixels (nearest-neighbour, no anti-aliasing/blur). The engine sets `imageSmoothingEnabled=false` for these.
- Transparent background (PNG alpha). Keep the AI source file beside the runtime PNG in a `*-src/` folder (excluded from deploy, like `assets/characters/portraits-src/`).

## Master palette

Grounded in the current in-game colours so new art blends with the existing primitive fallback. Use these ramps; per-region sub-palettes shift hue/saturation, not the lighting logic.

- **Grass:** shadow `#3f7a3f` · base `#63a858` · mid `#78c86d` · light `#9bd37c` · spec `#d7f28b`.
- **Soil/path:** shadow `#6f685f` · base `#a8a79d` · light `#c9c6ba`.
- **Water:** deep `#1d5968` · base `#226b78` · ripple `#3d8f9a` · foam/spec `#63b7bf`.
- **Wood/dock:** shadow `#5c362d` · base `#8f5b3f` · light `#b77752` · spec `#c98a60`.
- **Stone/wall:** shadow `#3f4738` · base `#626d55` · light `#788365`.
- **Foliage (trees):** darkest `#235829` → `#27602f` → `#347a3f` → `#4d9a55` → `#58a85f` → rim `#73c06d` → spec `#9bd888`; trunk `#523521`/`#6a4a32`/`#825d40`.
- **Neutrals:** outline `#1b232c` (avoid pure black) · UI parchment `#e6d3a4` · gold accent `#f2c14e`.

Region tints (apply lightly over the ramps above): Village warm green `126,184,96` · Modern Britain blue `92,132,184` · Rights & Law violet-grey `120,110,156` · Democracy gold `204,172,92` · Participation teal `72,162,172` · Action Workshop lime `152,178,98` · Exam Hall purple `120,100,162`.

## General rules for every sprite

- Limited palette per material (≈3–5 tones) — pick from the ramps above; no gradients/dithering soup.
- Soft single-pixel outline in `#1b232c` (or a darker shade of the fill) on silhouette edges; interactive objects keep a readable outline, flat décor can skip it.
- Tiles must tile seamlessly on all four edges; variation must be subtle (the engine sprinkles variants deterministically, so a tile must not look obviously repeated).
- No text baked into world art (signs/labels are drawn by code).

## Naming & folders

Filenames match the `*_ASSETS` keys the engine looks up. Drop PNGs here (source in the sibling `*-src/`):

- Tiles → `assets/tiles/` (e.g. `tile-grass.png`).
- Trees/foliage → `assets/tiles/` (e.g. `tree-oak.png`).
- Buildings (later) → `assets/buildings/` (e.g. `building-townhall.png`).
- Hero/NPC (later) → `assets/characters/`.

## Stage 1D test assets (please generate these two first)

Make ONLY these two first so we can validate the pipeline (crispness at ×1.5, alpha, pivot, palette) before mass-producing. The engine keeps its current primitive art as fallback, so nothing breaks while these are in progress.

1. **`assets/tiles/tile-grass.png` — 48×48**, transparent or opaque, seamless on all edges. Use the Grass ramp; gentle top-left lighting; a few darker/lighter blades or specks, but calm enough to repeat across a field without obvious seams. No cast shadow.
2. **`assets/tiles/tree-oak.png` — 96×144**, transparent, **pivot = bottom-centre** (trunk base centred on the bottom edge). A rounded oak: layered canopy using the Foliage ramp (darker lower-right, lit upper-left, a few rim/spec highlights), short trunk with bark shading. **No baked ground shadow** (engine adds it). Canopy may overhang the trunk; the player will walk behind the canopy.

**Acceptance check (agent will run):** drop the PNGs in, serve the game, confirm 1:1 crisp pixels at ×1.5, correct transparency, the tree's feet sit on the tile under the engine's cast shadow, and the palette matches. Then I wire them via `TILE_ASSETS`/a tree asset hook with primitive fallback and add a file-exists check to `scripts/validate-world.js`. After validation we proceed to the rest of the tiles + variations.