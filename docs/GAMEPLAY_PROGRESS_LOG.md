# Gameplay Progress Log

This document records what changed at each implementation step while we work through `GAMEPLAY_UPGRADE_PLAN.md`.

> **V2 (2026-06-17).** The full, entry-by-entry V1 history (2026-06-03 → 2026-06-12, ~75 entries) is archived in [`GAMEPLAY_PROGRESS_LOG_V1.md`](GAMEPLAY_PROGRESS_LOG_V1.md). The condensed V1 recap below is the carry-over baseline; add new V2 entries under "V2 entries", newest first.

## V1 recap (condensed)

V1 shipped as `2026.06.12.34` (save schema `SAVE_VERSION = 7`), with world/UI validation and headless visual/playthrough QA all green. It was built in these phases:

- **RPG foundation (P0–P2).** Final-exam + mini-game integration, item effects, Focus/stat clarity, economy & vendors, story choices + Apathy Shade reactions, curriculum tracking, menu/mobile ergonomics, and village/exterior map cleanup.
- **QA automation & release hardening (P2).** UI-regression, pathfinding reachability, desktop/mobile visual smoke, regional mini-game-host playthrough, regional quest/gate playthrough, the QA runbook, and local release smoke.
- **Accessibility & balance (F5).** Settings/accessibility toggles (large text, high contrast, reduced motion), an XP/Focus/coin/readiness balance review, and a visual-readability pass.
- **Readability asset passes (§20.1–20.4).** Visual style guide + seed assets, hero-customisation visuals, item/Backpack visuals, and story/mini-game visuals.
- **Map Phases 1–5.** Map audit + connectivity checks, recomposition of all six exterior regions (Modern Britain, Rights & Law, Democracy, Participation, Action Workshop, Exam Hall), mini-game marker status, trigger props + their PNG assets, and route QA.
- **Graphics generation G0–G2 + Options A/B/C.** Render foundation (image cache, animated-sprite helper, delta-time clock, y-sorting), terrain tileset, hero spritesheet; atmosphere/lighting, a cohesive multi-tone art atlas, UK symbolism + walk dynamics, and ground autotiling + cast shadows — plus several hero side-view/walk artifact fixes.
- **G3 NPCs.** Sliced portraits wired into dialogue (with procedural SVG fallback), world bodies with outline/shading + role kits, and ambient walkers for background life.
- **G4–G9.** Building exteriors by purpose, interiors by purpose, HUD/menus/inventory/Character polish, mini-game scene banners + medals, on-topic NPC speech bubbles + chatter pool, region declutter + road structure, detailed NPC Talk text, region pets, and a terrain tile-art upgrade.
- **G8 learning depth.** Keyword Catcher + Spark Sorter real-time mini-games, a quest "Why this matters" explanation block, per-topic curriculum mastery tracking, the hero-outfit world recolour fix, and a spaced-review queue (bumped `SAVE_VERSION` 6 → 7).

Full detail, including per-entry validation commands and live-deploy notes, is in [`GAMEPLAY_PROGRESS_LOG_V1.md`](GAMEPLAY_PROGRESS_LOG_V1.md).

## V2 entries

_(newest first)_

## 2026-06-17 — V2 workspace bootstrap

Plan area: V2 startup (new-graphics overhaul fork of the V1 final).

What changed:
- Created the V2 Azure Static Web App `citizenship-valley-v2` (resource group `rg-citizenship-game`, West Europe, Free); live at `https://black-grass-036ec2d03.7.azurestaticapps.net`.
- Reset the cache-bust version in `index.html` to semantic `2.0.0` (all 5 markers); deploys now bump the patch (`2.0.1`, …).
- Repointed all V2 identifiers (repo `NickyScout/citizenship-valley-v2`, new SWA name, resource group, live URL) across `AGENTS.md`, `.github/copilot-instructions.md`, `README.md`, and `docs/AI_HANDOFF.md`; section 0 of `AI_HANDOFF.md` rewritten as the V2 START baseline.
- Removed the legacy `publish/` mirror and its sync step from the docs; deploy builds `dist/` from the repo root. Fixed the deploy recipe to delete `dist/assets/characters/portraits-src` (was incorrectly removing the real `portraits/` folder).
- Archived the full V1 progress log to `GAMEPLAY_PROGRESS_LOG_V1.md` and condensed this log.

Validation:
- `node --check game.js`, `node --check curriculum.js`
- `node scripts\validate-world.js`, `node scripts\validate-ui.js`
