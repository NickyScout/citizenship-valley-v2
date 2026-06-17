# QA Runbook

This runbook collects the local QA checks used for Citizenship Valley. The app is still static HTML/CSS/JS, so the suite uses Node syntax checks, VM validators, and headless Chrome/CDP scripts rather than a framework test runner.

## Prerequisites

- Run commands from the project root.
- Use the local Node toolchain when available:

```powershell
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
```

- Browser automation expects Chrome at:

```text
C:/Program Files/Google/Chrome/Application/chrome.exe
```

## Quick Checks

Use this for small JavaScript or data-only changes:

```powershell
node --check game.js
node --check curriculum.js
node --check scripts\audit-map.js
node --check scripts\qa-route-audit.js
node scripts\validate-world.js
node scripts\validate-ui.js
```

What this covers:

- JavaScript parse checks.
- Map audit generator syntax check.
- Route QA audit generator syntax check.
- World structure, quest data, travel gates, NPC placement, building doors, interior exits, study stations, mini-game hosts, and Exam Hall practice room reachability.
- NPC-door interaction conflict checks, so `E` prompts should not compete between a door and an NPC.
- UI VM checks for save migration, mini-game definitions, achievement IDs, static buttons, and panel render smoke.

After map data changes, refresh the generated audit:

```powershell
node scripts\audit-map.js --write
```

After route-affecting map changes, refresh route QA:

```powershell
node scripts\qa-route-audit.js --write
```

## Browser Regression Checks

Use this after UI, mini-game, quest, save/load, map, or flow changes:

```powershell
node --check qa-ui-regression.mjs
node --check qa-visual-smoke.mjs
node --check qa-regional-playthrough.mjs
node --check qa-regional-quests-playthrough.mjs
node --check qa-release-smoke.mjs

node qa-ui-regression.mjs
node qa-visual-smoke.mjs
node qa-regional-playthrough.mjs
node qa-regional-quests-playthrough.mjs
node qa-release-smoke.mjs
```

What this covers:

- `qa-ui-regression.mjs`: New Game, customization, primary menus, Settings accessibility toggles, and one saved mini-game result.
- `qa-visual-smoke.mjs`: desktop/mobile screenshots, Settings panel, nonblank canvas, horizontal overflow, mobile touch controls, and overlay fit.
- `qa-regional-playthrough.mjs`: post-Village mini-game host NPCs, real NPC menu launch, all 7 mini-games, and saved gold results.
- `qa-regional-quests-playthrough.mjs`: 30 post-Village quests, rendered answer buttons, travel gates through Exam Hall, final gate panel, badges, story flags, and save persistence.
- `qa-release-smoke.mjs`: local desktop/mobile release smoke, Settings persistence/reset, keyboard/touch movement, Dev Travel region spot checks, and mini-game host button checks.

Visual rules for interpreting screenshots live in `docs/VISUAL_STYLE_GUIDE.md`.

## Full Local QA Suite

Use this before handoff, release, or deployment:

```powershell
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
node --check game.js
node --check curriculum.js
node --check scripts\audit-map.js
node --check scripts\qa-route-audit.js
node --check qa-ui-regression.mjs
node --check qa-visual-smoke.mjs
node --check qa-regional-playthrough.mjs
node --check qa-regional-quests-playthrough.mjs
node --check qa-release-smoke.mjs
node scripts\validate-world.js
node scripts\validate-ui.js
node scripts\audit-map.js --write
node scripts\qa-route-audit.js --write
node qa-ui-regression.mjs
node qa-visual-smoke.mjs
node qa-regional-playthrough.mjs
node qa-regional-quests-playthrough.mjs
node qa-release-smoke.mjs
```

Expected result summary:

- World validation passes with 7 locations and 45 quests.
- Route QA passes for all 7 exterior regions.
- UI validation passes with save migration to current `SAVE_VERSION`, 7 mini-games, and 19 achievements.
- Browser scripts report `blockingIssues: 0`.
- Visual smoke reports 12 screenshots.
- Regional mini-game host playthrough reports 8 hosts and 7 unique games.
- Regional quest playthrough reports 6 regions, 30 completed quests, and `finalLocation: examHall`.
- Release smoke reports 7 region spot checks and `deploymentSmoke: not-run` unless a deploy is explicitly performed.

## Generated Artifacts

The QA scripts write local artifacts:

- `qa-ui-regression-result.json`
- `qa-visual-smoke-result.json`
- `qa-regional-playthrough-result.json`
- `qa-regional-quests-playthrough-result.json`
- `qa-release-smoke-result.json`
- `qa-first-location-playthrough-result.json` when the first-location script is run manually
- `qa-route-audit-result.json`
- `qa-screenshots/*.png` from visual smoke

These are useful for manual inspection and handoff notes. Refresh them before relying on their contents.

## Manual Follow-Up

Automated scripts place the player next to NPCs by setting `state.player.x/y` to an interactable nearby position. This validates menu, quest, save, region, and reachability logic, but it is not a full manual keyboard pathfinding pass.

Use `docs/RELEASE_SMOKE_CHECKLIST.md` for release-candidate manual checks.

Before a polished release, also do a short manual smoke:

- Start New Game in a desktop browser.
- Walk around Citizenship Village from spawn using keyboard controls.
- Open Backpack, Progress, Character, and Mini-games.
- Try mobile/touch layout in browser device emulation.
- Use Dev Travel to spot-check each region visually.
- Hard refresh the deployed site after publish and confirm the HUD version.