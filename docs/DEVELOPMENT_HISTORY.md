# Development History

How Citizenship Valley was built, the decisions that still hold, the lessons not to relearn, and the forward plan. This consolidates the old V1 gameplay plan, the V2 graphics plan, and the detailed progress logs. For "what exists today" see [PROJECT_FEATURES.md](PROJECT_FEATURES.md); for the authoritative current technical state and deploy recipe see [AI_HANDOFF.md](AI_HANDOFF.md).

> The full, entry-by-entry V1 build log and the original Russian plans were folded into this summary and removed from `docs/`. They remain in git history (e.g. `git log --follow -- docs/GAMEPLAY_PROGRESS_LOG_V1.md docs/GAMEPLAY_UPGRADE_OLD.md docs/GAMEPLAY_UPGRADE_PLAN.md`).

## Timeline at a glance

1. **Prototype** — a static canvas RPG: seven regions, NPC dialogue, quests, travel gates, `localStorage` save.
2. **V1 RPG framework (Phases A–F)** — turned the prototype into a full educational RPG: start flow, customisation, inventory/economy, stats + Exam Readiness, story + Apathy Shade, seven mini-games, and the final Exam Simulation.
3. **V1 backlog (P0–P2) + F5** — integrated mini-games into the world, made the Exam Simulation a real finale, balanced stats/Focus, deepened items/economy/story choices, curriculum tracking, menu/mobile UX, QA automation, and an accessibility/polish/release-hardening pass.
4. **V1 readability passes (§20.1–20.4)** — a visual style guide and seed assets, hero-customisation visuals, item/Backpack visuals, and story/mini-game visuals.
5. **V1 Map Phases 1–5** — map audit + connectivity checks, recomposition of all six exterior regions, mini-game marker status, trigger props + PNG assets, and route QA.
6. **V1 graphics generation (G0–G9, + Options A/B/C)** — render foundation, terrain tileset, hero spritesheet, NPC recognisability + ambient life, building exteriors/interiors by purpose, HUD/mini-game/learning depth, and atmosphere — each shipped as a first pass. V1 finished at version `2026.06.12.34`, `SAVE_VERSION = 7`.
7. **V2 fork (2026-06-17)** — forked to repo/SWA `citizenship-valley-v2`, version reset to `2.0.0`. V2 is a **new-graphics overhaul** that revisits the same priorities at higher quality; all V1 gameplay systems carry over as the foundation.

## V1 phases in detail (condensed)

- **Phase A — RPG skeleton**: title screen, character creation (name/gender/outfit/accent), starting inventory + coins, new `state` model with `migrateSave`, base HUD (level/XP/focus).
- **Phase B — Progress & inventory**: categorised inventory UI, Quest Log / Progress / Achievements panels, a per-region Buildings Journal.
- **Phase C — Stats & exam chance**: `state.stats`, the `examChance()` formula, stat growth tied to quests, a Character panel for spending points, and "Exam Readiness" in the HUD.
- **Phase D — Story**: `state.storyAct` + `STORY_BEATS`, the Apathy Shade per region, canvas story cutscenes, and the endings.
- **Phase E — Mini-games**: Source Detective, Rights vs Responsibilities, Petition Regatta, Ballot Count, Debate Arena, Campaign Planner, and the Exam Simulation finale.
- **Phase F / P0–P2 / F5 — polish & depth**: mini-games anchored to world trigger props; Exam Simulation 2.0 with sections + ending influence; RPG/Focus balance; more "playable" items; economy & vendors; deeper story choices; curriculum tracking as real learning progress; menu/mobile ergonomics; QA automation (UI regression, reachability, visual smoke, regional/quest playthroughs, release smoke); and accessibility (large text, high contrast, reduced motion).
- **Map Phases 1–5**: `scripts/audit-map.js` + `MAP_AUDIT.md`; recomposed exterior regions with landmark signposts and themed props; dynamic mini-game map-marker status; explicit trigger props wired to each mini-game with PNG/SVG assets; `scripts/qa-route-audit.js` + `MAP_ROUTE_QA.md` route QA for all exterior regions.
- **Graphics generation G0–G9**:
  - **G0** render foundation — shared `imageCache`/`getAssetImage`, an `AnimatedSprite` helper, a safe frame clock (`nowMs`/`frameDeltaMs`/`animationClockMs`), an empty Reduced-Motion-aware `drawAmbientLayer()`, and y-sorted characters (no visible art change).
  - **G1** terrain tileset — `TILE_ASSETS` SVGs, asset-backed tiles with primitive fallback, deterministic variation, and water/road/plaza edge overlays (ASCII maps unchanged).
  - **G2** hero spritesheet — `assets/characters/hero-base-spritesheet.svg`, `HERO_ASSETS`, 4-dir × 4-frame, with the old procedural `drawHero*` as fallback and customisation overlays on top.
  - **Options A/B/C** — atmosphere/lighting (colour grade, vignette, particles, smoke, shadows); a cohesive multi-tone art atlas + UK symbolism + walk dynamics; and ground autotiling (foam/beaches/edges) + cast shadows.
  - **G3** NPCs — sliced portraits wired into dialogue (fallback to procedural SVG), outlined/shaded world bodies with role kits, ambient walkers, and on-topic speech bubbles.
  - **G4–G9** — building exteriors by purpose; purpose-based interiors; HUD/menu/inventory/Character polish; mini-game scene banners + medals; learning depth (Keyword Catcher, Spark Sorter, "Why this matters", mastery tracking, spaced review); region declutter + road structure, detailed NPC Talk text, region pets, and a terrain tile-art upgrade.

## Key design decisions (still in force)

- **Stay static and simple.** Plain HTML/CSS/JS, no framework/bundler/backend — for fast iteration and easy Azure Static Web Apps hosting. Don't add a framework until the single JS file becomes genuinely unmaintainable.
- **Education first, game feel second.** Never a bare quiz — wrap every knowledge check in an action. Keep GCSE content accurate and age-appropriate.
- **`curriculum.js` is the single source of truth** for GCSE explanations and topic metadata; world/quest data may move out of `game.js` later, but only as a focused data refactor.
- **Save compatibility is sacred.** Bump `SAVE_VERSION` only on schema change, default new fields, and keep `migrateSave()` working for old saves.
- **Every new art asset needs a primitive fallback** so the game never blanks and visual smoke keeps passing.
- **Preserve keyboard controls and the dev travel menu** when adding input methods or features.
- **Reachability is an invariant.** Each building entrance is reachable; NPCs aren't in a door's `E` radius; gates/hosts/study-stations/trigger-props stay reachable; ambient walkers never block passages or park on doors.
- **Deploy only on explicit request**; never print or commit the deployment token.

## Hard-won lessons (do not regress)

- **NPC face geometry**: the mouth sits at `y+14` over `x+8..x+18`; role kits/hair/beard draw *after* the face, so any opaque costume band at `y+14–15` over the face centre hides the mouth. Keep neckwear at `y+18`+ (below the chin) and keep art off the `x+11..x+16` column directly under the mouth.
- **Hero spritesheet** must be drawn at `Math.round(x), Math.round(y)` (`rect()` rounds, `drawImage` doesn't → a 1px shelf while walking). Keep per-frame rects within the sheet row.
- **World markers** must hold all their text inside one board and clear the prop top (a label drawn below a board lands on the prop art — the original kiosk "New" bug).
- **Deploy in separate steps** (bump → build → deploy → verify). A single `;`-chained command can deploy a stale `dist/`. Returning browsers won't refetch an identical `?v=`, so bump all five cache-bust markers in `index.html`.
- **Browser-montage QA**: to inspect sprites at zoom, kill the render loop in `page.evaluate` (`requestAnimationFrame`/`draw` no-ops), set Reduced Motion, hide quest "!" and the title/touch overlays, then draw sprites onto a viewport-sized canvas and capture with the screenshot tool (toggle viewport size to force a fresh frame). See [AI_HANDOFF.md](AI_HANDOFF.md) §0 for the full recipe.

## V2 art direction (forward guide)

V2's goal is a **quality jump in graphics**, prioritising the play-field first. Principles:

1. **Art resolution** — logical tile `32px`, screen `×1.5`; draw sprites at logical scale so they line up with the world. PNG with transparency, SVG sources kept alongside where practical.
2. **Master palette** — shared shadow/light tones, regional sub-palettes, status colours (quest/mini-game/shop/story/exam); maintained in [VISUAL_STYLE_GUIDE.md](VISUAL_STYLE_GUIDE.md).
3. **Readability** — interactive objects (NPCs, doors, trigger props, study stations) get a soft outline + shadow; non-interactive décor stays unoutlined.
4. **Depth** — oval contact shadows, light ambient occlusion at bases, y-sorting.
5. **Regional identity through silhouette, not just colour** — a recognisable landmark, paving type, greenery/water, and building "views" per region.
6. **Performance over spectacle** — spritesheets instead of dozens of `rect()` calls, capped/disableable ambient effects, a modest asset budget, target 60 FPS on a mid laptop.

Technical invariant: any new art must fall back to the existing primitive render (as `drawPropAsset` does).

## Remaining roadmap (priority order)

V1 delivered first passes of all stages below; V2 revisits them at higher art quality. Work in small, reviewable, QA-gated steps; bump the semantic version (`2.0.x`) on each deploy.

1. **Play-field (top priority)** — terrain/tilesets + autotiling; hero spritesheet/animation; NPC recognisability + background life; building exteriors; atmosphere.
2. **Building interiors by purpose.**
3. **Menus / HUD / inventory / Character art.**
4. **Mini-game art** (themed cards/boards, canvas animations, medal screens).
5. **Learning depth & variety** (more check formats, "why" feedback, review/mastery, more scenario variety) — can run in parallel with 3–4.
6. **Atmosphere & polish** (particles, ambient light, transitions, feedback) + a performance/asset-budget pass and accessibility checks.

**Success criterion**: recognisable, living locations (varied terrain, animated hero, walking NPCs and background life), distinct building exteriors and themed interiors, richer menus/inventory/mini-games, and a varied, understandable learning flow — while keeping the app lightweight, saves compatible, and the "region → NPC → activity → reward → progress" loop stable.

## QA gate per stage

`node --check game.js` / `curriculum.js`; `scripts/validate-world.js`; `scripts/validate-ui.js`; `scripts/audit-map.js` + `scripts/qa-route-audit.js` after map changes; `qa-visual-smoke.mjs` (desktop/mobile, non-blank canvas, no overflow); regional + regional-quest playthroughs when NPCs change; release smoke before a release candidate. Full command set in [QA_RUNBOOK.md](QA_RUNBOOK.md).
