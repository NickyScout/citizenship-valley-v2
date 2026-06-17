# Project Features

A snapshot of what Citizenship Valley **is today** — its systems, content, and characteristics. This is the "what exists" reference; for "how it got here" and the forward plan see [DEVELOPMENT_HISTORY.md](DEVELOPMENT_HISTORY.md), and for the authoritative current technical state see [AI_HANDOFF.md](AI_HANDOFF.md).

> Derived by consolidating the V1 progress logs and implementation notes. Authoritative counts below were confirmed from the code and validators (7 regions, 45 quests, 5 exam rooms, 11 mini-games, 19 achievements, `SAVE_VERSION = 7`).

## What it is

A browser-based, top-down indie RPG that helps a student revise **UK GCSE Citizenship**. The curriculum is presented as a themed world: explore a region, meet NPCs, take short investigation quests and mini-games, earn rewards, raise your "Exam Readiness", and pass a knowledge-checked travel gate to unlock the next region — ending in a final exam. Educational clarity comes first; every knowledge check is wrapped in an action (dialogue, investigation, choice, or mini-game) rather than a bare quiz.

## Architecture snapshot

- Static **HTML/CSS/JavaScript** with canvas rendering. No framework, bundler, TypeScript, backend, auth, or network calls.
- [index.html](../index.html) — page shell, canvas, HUD/dialogue containers, script order, cache-bust version markers.
- [styles.css](../styles.css) — HUD, inventory, settings/accessibility, central NPC dialogue, responsive desktop/mobile layout.
- [game.js](../game.js) — the game loop, canvas rendering, world data, NPCs, quests, movement, inventory, mini-games, story state, save/load, and UI event handling.
- [curriculum.js](../curriculum.js) — the editable GCSE topic map (sections, topics, NPC prompts, longer correct-answer explanations) exposed via `window.GCSE_CURRICULUM_INDEX`.
- Rendering: `1280×768` canvas, logical tile `32` drawn at `1.5×` (48px visible), camera follows the player. Draw pipeline is layered: ground → paths → buildings → props → characters → world-UI, then screen UI.
- Progress saved to browser `localStorage` (`citizenshipValleySaveV1`, `SAVE_VERSION = 7`); display settings saved separately. `migrateSave()` keeps older saves loadable.

## World & content

- **Seven regions**, each with its own NPC cast, curriculum-linked quests, and a knowledge-gated exit:
  1. Citizenship Village (tutorial)
  2. Modern Britain Borough
  3. Rights & Law Quarter
  4. Democracy Capital
  5. Participation Harbour
  6. Action Workshop
  7. Exam Hall Castle (finale)
- **45 quests** total across the regions.
- **Travel gates**: a region's gate opens only after its quests are complete, then asks three questions — all three must be correct to unlock the next region; a wrong answer blocks travel until retried.
- **Exam Hall Castle** has **5 practice rooms** mapped to GCSE answer types: Identify, Describe, Explain, Evaluate, and Source usefulness.

## Core gameplay loop

Accept a quest from an NPC → travel to another NPC for evidence → return to the giver → answer a GCSE-style check question → earn coins/items/knowledge and stat gains → raise Exam Readiness → clear the travel gate → progress the story.

## RPG systems

- **Start flow & customisation**: title screen (Continue / New Game / Credits), then a "Create your citizen" screen. `state.profile` holds name, gender preset, outfit, and accent colour; the chosen outfit recolours the in-world hero and the portrait so the four start presets look clearly different.
- **Stats** (`state.stats`): `knowledge`, `rhetoric`, `empathy`, `integrity` (skills), `focus` (spendable), plus `xp`/`level` and collected `spark`s. Quests and mini-games award XP and targeted stat gains.
- **Exam Readiness**: `examChance()` = `clamp(READINESS_BASE + Σ(stat × READINESS_WEIGHTS) + sparks × 1.5, 0, 95)`, surfaced as "Exam Readiness %" in the HUD and on the ending. Weighted most heavily toward `knowledge`.
- **Inventory & economy**: categorised Backpack (quest / consumable / equipment / collectible) with Outfit/Tool/Badge slots, a selected-item detail panel, item effects, equip/use/sell actions, coins, and per-region vendors. Quest items are lockable and unsellable. Held tools (e.g. Justice Quill, Debate Blade) render as distinct silhouettes on the hero.
- **Badges & achievements**: 19 achievements tracked in `state.achievements`.

## Mini-games (11)

Short (1–3 min) curriculum-linked modules launched from regional NPC menus, each rewarding coins/XP/stats and a medal (Bronze/Silver/Gold), with themed scene banners and result/medal blocks. They include:

- **Source Detective** (Modern Britain) — judge media reliability; trains media literacy.
- **Rights vs Responsibilities** (Rights & Law) — match a right to the responsibility that sustains it.
- **Petition Regatta** (Participation) — steer a campaign boat toward signatures, away from misinformation.
- **Ballot Count** (Democracy) — count votes under First Past the Post.
- **Debate Arena** (Democracy / Action Workshop) — card-style debate using rhetoric/empathy.
- **Campaign Planner** (Action Workshop) — order Research → Plan → Action → Evaluate.
- **Keyword Catcher** & **Spark Sorter** — real-time vocabulary/sorting games (G8).
- Two Hangman-style word games for civic vocabulary, plus the Exam Simulation sections.
- **Exam Simulation** (Exam Hall) — multi-section final exam (Identify/Describe/Explain/Evaluate/Sources) with a section breakdown that influences the ending.

## Story & endings

- A light story spine: the valley is losing its "sparks of participation"; the antagonist is the **Apathy Shade** — an abstract force of indifference, not a human villain — with a dedicated story silhouette asset and subtle traces in unresolved regions.
- Acts run region-by-region from the village to the sealed Exam Hall Castle. Story choices are tracked as flags and feed the ending.
- **Three endings** — Bronze / Silver / Gold Citizen — gated by exam result, social choices, and completeness (topics, mini-games, sparks).

## Learning systems

- **Curriculum source of truth**: [curriculum.js](../curriculum.js) holds topic metadata (area/difficulty/stat boosts/mini-game refs/exam skill) and rich correct-answer explanations.
- **"Why this matters"** block surfaces the full curriculum explanation after a regional quest answer, separate from the reward line.
- **Per-topic mastery tracking**: a 4-tier model (To start → Learning → Secure → Mastered) derived from existing signals (completed quests + area mini-game medals + study stations); no save-schema change.
- **Spaced review queue**: completing a quest schedules a review; a Revision Journal surfaces due topics on a 1→2→4→8-day ladder ("Come back and revise"). Persisted as `reviewLog` (introduced with `SAVE_VERSION` 7).
- **On-topic NPC speech bubbles**: ambient/idle NPCs periodically show short, region-appropriate civic phrases to reinforce learning unobtrusively (gated by Reduced Motion, never overlapping quest/`E` markers).

## Graphics & presentation

- **Terrain**: SVG tilesets in `assets/tiles/` with primitive fallback, autotiling edges (grass↔road/plaza, land↔water foam + beaches), deterministic variation, and cast shadows.
- **Hero**: asset-backed 4-direction × 4-frame spritesheet with procedural fallback; outfit/hair/cap/scarf/side-arm overlays, a held-tool layer, a waving Union Jack, and walk/idle animation.
- **NPCs**: outlined, shaded world bodies with role kits (police helmet, hi-vis, council chain, rosette, petition board, book, charity tabard, mark scheme, collar tabs, data tablet, media badge, scarf), y-sorted; plus **ambient walkers** (background life) with delta-time wandering, collisions, and Reduced-Motion gating.
- **Portraits**: real PNG portrait cards in `assets/characters/portraits/` shown in the landscape dialogue panel (procedural SVG fallback). Source atlases live in `portraits-src/` (excluded from deploy).
- **Atmosphere**: regional colour grade + vignette + soft top light, ambient particles and chimney smoke, contact shadows, region transitions, footstep dust, and an interaction pulse — all Reduced-Motion aware.
- **Buildings**: typed exteriors with recognisable silhouettes and purpose-based interiors; trigger props (kiosk, notice, ballot box, podium, planning board, exam desk, etc.) carry mini-game "Play"/status markers.
- **Region pets**: a wandering animal per region with light sounds/jokes.

## Accessibility & settings

- Settings overlay from the HUD with persistent **Large text**, **High contrast**, and **Reduced motion** toggles (Reduced Motion gates all ambient animation).
- A reset-save control that preserves display settings.

## Controls

- Movement: `WASD` or arrow keys. Interact/talk/inspect: `E`. Answer questions: `1` / `2` / `3`.
- Touch controls for mobile, plus menu buttons.
- A **developer travel menu** for quickly switching regions during testing (kept intentionally).

## QA & tooling

- VM validators: [scripts/validate-world.js](../scripts/validate-world.js) (reachability, NPC/door conflicts, tile-asset existence) and [scripts/validate-ui.js](../scripts/validate-ui.js) (save migration, render/saved-state invariants).
- Map/route audits: [scripts/audit-map.js](../scripts/audit-map.js) → [MAP_AUDIT.md](MAP_AUDIT.md); [scripts/qa-route-audit.js](../scripts/qa-route-audit.js) → [MAP_ROUTE_QA.md](MAP_ROUTE_QA.md).
- Headless browser scripts: visual smoke, UI regression, regional and regional-quest playthroughs, release smoke, portrait slicing.
- Canonical command set: [QA_RUNBOOK.md](QA_RUNBOOK.md). Release checklist: [RELEASE_SMOKE_CHECKLIST.md](RELEASE_SMOKE_CHECKLIST.md).
