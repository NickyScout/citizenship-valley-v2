# AI Handoff

## 0. V1 FINAL — handoff to V2 (2026-06-17)

> This section is the authoritative current state. **Everything below section 0 is historical (pre-2026-06-05) and partly outdated — read it for background only, and trust this section where they conflict.** V2's focus is a **new-graphics overhaul**.

### V1 final state
- Live site: `https://lemon-meadow-063d62b03.7.azurestaticapps.net`, version **`2026.06.12.34`**, all QA green.
- Git: root **IS** a normal Git repo now (the old "use publish/ for git" note below is OBSOLETE). Remote `NickyScout/citizenship-valley`, branch `main`, tag **`v1.0`** marks this final state. Commit + `git push origin main` from the **root**.
- Node: bundled at `.tools/node-v22.11.0-win-x64` (gitignored). Always prefix:
  `$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"` before node commands.
- **No `package.json` at root** — `node_modules/` (holds the `swa` CLI) is NOT reproducible via `npm install`; it must be carried over, not reinstalled.

### Deploy recipe (verified, current)
1. Bump the cache-bust version in `index.html` — **5 markers**: `styles.css?v=`, `<body data-app-version=`, `#appVersion` text `v…`, `curriculum.js?v=`, `game.js?v=`. Returning browsers won't refetch an identical `?v=`.
2. Build `dist/`: copy `index.html,styles.css,game.js,curriculum.js,staticwebapp.config.json` + `assets/` into `dist`, then delete `dist/assets/characters/portraits-src` (source atlases, excluded from deploy).
3. Token (never print/commit): `az staticwebapp secrets list --name citizenship-gcse-game-nmilyaev --resource-group rg-citizenship-game --query properties.apiKey -o tsv`.
4. `.\node_modules\.bin\swa.cmd deploy .\dist --deployment-token $token --env production`.
5. **Verify LIVE** flipped: fetch `index.html?cb=<ts>` for the new version + `game.js` for the changed line. Split bump/build/deploy/verify into separate commands (a giant `;`-chain can deploy a STALE dist).
- After deploy, `git push origin main` (separate from Azure). Verify sync `git rev-list --left-right --count origin/main...HEAD` == `0 0`. `publish/` and `*-result.json` are gitignored — never staged.

### QA (all pass at v1.0)
`node scripts\validate-world.js` · `node scripts\validate-ui.js` · `node qa-visual-smoke.mjs` (+ `node --check game.js`, regional/route audits in `docs/QA_RUNBOOK.md`).

### Graphics architecture (the V2 replacement target)
All art is hand-coded pixel-art via `rect(x,y,w,h,color)` + a few SVG/PNG assets under `assets/`. Canvas `1280×768`, logical tile `32`, `RENDER_SCALE=1.5`. `animationClockMs` drives animation; `settings.reducedMotion` gates ALL motion. Draw pipeline in `drawWorld()`: ground → paths → buildings → props → characters → world-UI.
- **NPC sprite**: `drawPerson(person)` reads `npcAppearance(person)` (memoized per id in `npcAppearanceCache`; merges `npcStyle` coat + `NPC_LOOK` skin/hair + role + `NPC_HAIR` style/beard + animPhase + build). Hair via `drawNpcHair`, beard `drawNpcBeard`, costume `drawNpcRoleKit(p,role,style)` (roles: police/council/law/democracy/media/book/data/care/campaign/time/exam/citizen). Role from `NPC_ROLE` map.
- **NPC face geometry (local coords)**: head `x+4..x+24` (centre `x+14`), eyes `y+9`, **mouth `x+11..x+16, y+14`**, chin/face-bottom `y+18`.
- **Hero**: `drawHeroSpriteAsset` (spritesheet `assets/characters/hero-base-spritesheet.svg`, 4 dir × 4 frame) + overlays in `drawHeroProfileMarkers` (outfit recolor, hair, cap, scarf, side-arm, flag). Procedural `drawHeroFront/Back/Side` fallback.
- **Tiles**: `drawTile` + `TILE_ASSETS` (SVG in `assets/tiles/`) with primitive fallback + autotiling edges (`drawWaterFoam/drawBeachEdges/drawPavingEdges`).
- **Props**: `drawProp` (primitive art per `prop.type`) tries `drawPropAsset` (`PROP_ASSETS` PNGs) first; `propAssetBounds` holds per-type widths. Mini-game "Play" markers `drawMiniGameTriggerMarkers`; NPC host "Game" markers `drawMiniGameHostMarkers`.
- **Portraits**: real PNG cards in `assets/characters/portraits/` (sliced by `qa-slice-portraits.mjs` from `portraits-src/`), shown in the landscape dialogue panel; procedural SVG fallback only.

### Hard-won art rules (do NOT regress in V2)
- The mouth is at `y+14` over `x+8..x+18`; `drawNpcRoleKit`/hair/beard draw AFTER the face, so **any opaque costume band at `y+14–15` over the face centre HIDES the mouth**. Keep neckwear at **`y+18`+ (below the chin)**. Bright/low-contrast garments (hi-vis yellow) need `y+18` even though `y+15` is technically below the mouth.
- **Vertical/centred** elements touching the mouth's bottom edge also merge — keep costume art off the `x+11..x+16` column directly under the mouth (route sashes/cords diagonally/to the side from `y+20`).
- Beards: moustache `y+12-13` ABOVE, chin beard `y+16-18` BELOW, mouth drawn after → keep the `y+14` row clear.
- World markers that float above a prop must hold ALL their text inside one board AND clear the prop top (a label drawn below a board lands on the prop art — that was the kiosk "New" bug).
- Hero spritesheet MUST be drawn at `Math.round(p.x),Math.round(p.y)` (rect() rounds, drawImage doesn't → 1px shelf while walking). Keep per-frame rects within the 48px sheet row (bleed rule).

### Browser-montage QA recipe (how to inspect sprites at zoom)
Serve the game; in `page.evaluate` set `window.requestAnimationFrame=()=>0` **and** `window.draw=function(){}` to KILL the render loop (it repaints over your montage — the title screen is a DOM overlay so the canvas always runs), `settings.reducedMotion=true`, `state.completed={has:()=>true}` (hide quest "!"). Gather NPCs from `WORLD`+`locationBlueprints`, then per sprite `ctx.setTransform(scale,0,0,scale,ox,oy); drawPerson({id,name,x:0,y:0,color})`. Capture with the `screenshot_page` tool on a viewport-sized canvas (≤~1000×950, paginate); **toggle the viewport size to force a fresh capture** (it caches stale frames); first remove `#titleScreen` + `[aria-label="Touch controls"]`. Element/path `page.screenshot` HANGS on font-wait and clips a big canvas; downloads/`require` are unavailable in the playwright tool.

### Transfer notes for V2
- `publish/` is a **legacy gitignored mirror** of root files — V2 should DROP it and its sync step; the deploy builds `dist/` from root directly.
- Stale facts in the legacy sections below to ignore in V2: "root is not a Git repo / use publish/", "procedural SVG portraits" (real PNGs now exist), the G2/G3 TODO list, `SAVE_VERSION = 6` (see `migrateSave()` for the real current target).
- For V2 deploy: create a NEW SWA (analogous to the existing one, its own deployment token) and a NEW GitHub repo; update the SWA name / resource group / live URL / repo slug in `AGENTS.md`, `.github/copilot-instructions.md`, `README.md`, and this file.
- Repo memory (`/memories/repo/`) is workspace-scoped and will be EMPTY in the V2 workspace — this section is the bridge; re-seed memory from it after opening V2.

---

## 0. Current Status Update — 2026-06-05 (HISTORICAL — superseded by section 0 above)

Resume point after the planned PC restart:

- Active roadmap marker: the previous plan (RPG phases A–F + Map Phase 1–5) is closed and archived as `docs/GAMEPLAY_UPGRADE_OLD.md`. The new graphics-generation plan `docs/GAMEPLAY_UPGRADE_PLAN.md` is active; G0, G1, and G2 are closed as first technical/asset-backed passes. The next practical stage is G3 NPC recognisability + background life. All previously shipped systems remain the foundation.
- G0 added a shared `imageCache`/`getAssetImage`, an `AnimatedSprite` helper, safe frame timing (`nowMs`, `frameDeltaMs`, `animationClockMs`), an empty `drawAmbientLayer()` that respects Reduced Motion, and y-sorted character rendering. It intentionally did not change visible art or movement logic.
- G1 added `TILE_ASSETS` for base SVG tiles under `assets/tiles/`, asset-backed tile rendering with primitive fallback, light deterministic terrain variation, water/road/plaza edge overlays, and `scripts/validate-world.js` checks for tile asset file existence. ASCII maps and collision data were not changed.
- G2 added `assets/characters/hero-base-spritesheet.svg`, `HERO_ASSETS`, `heroBaseSprite`, `isHeroMoving`, and `drawHeroSpriteAsset`. The hero now tries an asset-backed 4-direction/4-frame spritesheet first, then falls back to the old procedural `drawHero*`; customization overlays and held tools remain visible on top.
- Sections §20.1, §20.2, §20.3, and §20.4 are closed as first-pass graphics/readability work.
- §20.1 added `docs/VISUAL_STYLE_GUIDE.md`, item PNG assets, seed UI/region prop assets, stronger regional motifs, and subtle Apathy traces.
- §20.2 added shared hero visual presets for HUD portrait, Character panel, and canvas sprite; held tools now render as distinct quill/blade silhouettes.
- §20.3 added Backpack category frames, selected item detail panel, item effect summaries, mouse/keyboard item selection, and quest item lock/unsellable markers.
- §20.4 added regional story title-card details, themed mini-game visual stage layouts, and visual medal/reward blocks on completion screens.
- §22 Map Phase 1 added `scripts/audit-map.js`, generated `docs/MAP_AUDIT.md`, and extended `scripts/validate-world.js` with an NPC-door interaction conflict check.
- §22 Map Phase 2 started with Modern Britain Borough: Media Plaza, Source Kiosk, and Underground Gate signposts plus a newspaper `kiosk` prop and supporting plaza props.
- Rights & Law Quarter now has Court Square, Rights Cards, and Clock Lift Gate signposts plus `scales`/`notice` legal props and supporting route props.
- Democracy Capital now has Ballot Hall, Count Table, Debate Steps, and Ferry Gate signposts plus `ballotBox`, `podium`, and `poster` election/debate props.
- Participation Harbour now has Petition Pier, Regatta Stand, Volunteer Dock, and Campaign Boat Gate signposts plus `petitionStand`, `boat`, and `banner` harbour/campaign props.
- Action Workshop now has Plan Board, Campaign Planner, Data Bench, and Lighthouse Bridge signposts plus `planningBoard`, `surveyBox`, `dataCards`, and `campaignTable` workshop props.
- Exam Hall Castle now has Final Gate, Exam Desk, Source Archive, and Debate Bench signposts plus `finalGate`, `examDesk`, `sourceArchive`, and `debateBench` exam props.
- Map Phase 2 first pass is closed for all exterior regions; `docs/MAP_AUDIT.md` records signs/props for every exterior region.
- Map Phase 3 started: mini-game host world markers now show dynamic completion labels from `state.miniGameScores` (`New`, `Try`, `Bronze`, `Silver`, `Gold`) without changing NPC menu launch flow or save format.
- First explicit trigger props are wired: Source Detective uses the Modern Britain `kiosk`, Rights Match uses the Rights & Law `notice`, and Petition Regatta uses the Participation `petitionStand`; these render `Play` markers and are audited/validated.
- Remaining trigger props are also wired: Ballot Count uses `ballotBox`, Debate Arena uses `podium` and `debateBench`, Campaign Planner uses `planningBoard`, and Exam Simulation uses `examDesk`.
- Progress → Mini-games now shows NPC host, trigger prop location, and dynamic map marker status for each mini-game.
- Map Phase 4 added PNG runtime assets plus SVG source assets for the most visible trigger props under `assets/props/region/`; canvas rendering uses `PROP_ASSETS` with primitive fallback.
- Map Phase 5 added `scripts/qa-route-audit.js`, `docs/MAP_ROUTE_QA.md`, and `qa-route-audit-result.json`; route QA passed for all 7 exterior regions.
- Focused QA after §20.4 passed: `node --check game.js`, `node --check curriculum.js`, `node scripts\validate-ui.js`, `node scripts\validate-world.js`, `node qa-ui-regression.mjs`, and `node qa-visual-smoke.mjs`.
- `publish/` was committed/pushed and the public Azure Static Web Apps site was deployed after G0/G1/G2 (`b11ff46`). Live markers checked: deployed `game.js` contains `HERO_ASSETS`/`TILE_ASSETS`, and live hero/tile SVG assets are available.
- Important user preference: after every completed game-development stage, publish the changes to the public Azure Static Web Apps site for the user's visual review/testing. Do not stop at local validation or GitHub push.
- Root `C:\PROJECTS\Citizenship Game` is not a Git repo. Use `publish/` for Git status, commits, and pushes.

## 1. Project Purpose

Citizenship Valley is a browser-based indie RPG prototype for helping a student revise UK GCSE Citizenship. The game presents the curriculum as a top-down RPG world with themed regions, NPC conversations, short investigation quests, rewards, and travel gates that test knowledge before the next region unlocks.

The current goal is educational first, game feel second: each quest should teach a GCSE Citizenship concept through NPC dialogue, then check understanding with a short multiple-choice question.

## 2. Current Architecture

This is a static HTML/CSS/JavaScript canvas game. There is no bundler, framework, TypeScript, or backend.

- `index.html` defines the canvas, HUD, dialogue containers, and script order.
- `styles.css` handles page layout, HUD, inventory UI, hero portraits, item category frames/detail panel, settings/accessibility modes, and the centered NPC dialogue window.
- `game.js` contains the game loop, canvas rendering, world data, NPCs, quests, movement, inventory, mini-games, story state, save/load, and UI event handling.
- `curriculum.js` defines the external curriculum guide and enriches quest explanations through `window.GCSE_CURRICULUM_INDEX`.
- Browser progress is saved in `localStorage` under `citizenshipValleySaveV1`; the current save version is `SAVE_VERSION = 6`. Browser display settings are saved separately under `citizenshipValleySettingsV1`.
- Azure Static Web Apps hosts the public static site. Current workflow expectation: after each completed implementation stage, validate locally, sync `publish/`, commit/push from `publish/`, deploy to production SWA, and verify live markers/assets. Do not print deployment tokens.

Rendering uses a `1280x768` canvas. The logical tile size is `32`, rendered at `1.5x` so visible tiles are `48px`. The camera follows the player. The draw pipeline is split into layers: ground, paths, buildings, props, characters, and world UI.

## 3. Main Folders and Important Files

- `index.html` - static shell, canvas, HUD, script includes.
- `styles.css` - visual styling for HUD, inventory, settings, central NPC dialogue, and responsive layout.
- `game.js` - main game implementation and most runtime data.
- `curriculum.js` - editable GCSE topic map grouped by location, with NPC prompts and longer correct-answer explanations.
- `CURRICULUM_MAP.md` - broader course/world planning notes.
- `README.md` - short project overview and play instructions.
- `docs/QA_RUNBOOK.md` - canonical local QA command set.
- `docs/MAP_AUDIT.md` - generated Map Phase 1 audit of spawn, landmarks, NPCs, doors, mini-game anchors, travel gates, blocked zones, interiors, and exam rooms.
- `docs/BALANCE_REVIEW.md` - latest XP/Focus/coin/readiness balance notes.
- `docs/RELEASE_SMOKE_CHECKLIST.md` - manual release-candidate smoke checklist.
- `docs/VISUAL_STYLE_GUIDE.md` - current visual conventions for tile scale, palettes, hero/item/story/UI assets, and QA expectations.
- NPC portraits are generated as inline SVG avatars in `game.js`; there is no portrait image folder at the moment.
- `assets/items/` - first PNG item icon pass used by Backpack thumbnails.
- `assets/ui/` - seed UI marker assets, currently including the mini-game marker source/runtime asset.
- `assets/props/region/` - seed regional prop assets, currently including ballot booth art.
- `assets/story/` - story-scene assets, including the dedicated Apathy Shade silhouette.
- `assets/tiles/`, `assets/characters/`, `assets/buildings/`, `assets/props/` - broader reserved asset structure for future PNG art.
- `qa-ui-regression.mjs`, `qa-visual-smoke.mjs`, `qa-regional-playthrough.mjs`, `qa-regional-quests-playthrough.mjs`, `qa-release-smoke.mjs` - local browser/CDP QA scripts.
- `scripts/audit-map.js` - VM-based map audit generator; run `node scripts\audit-map.js --write` after map data changes.
- `staticwebapp.config.json` - Azure Static Web Apps config.
- `.github/workflows/azure-static-web-apps.yml` - manual-only GitHub Actions deploy workflow for Azure Static Web Apps.
- `dist/` - local deployment folder, ignored by Git.
- `.tools/` and `node_modules/` - local tooling, ignored by Git.
- `publish/` - clean Git working copy tracking `NickyScout/citizenship-valley`. The root `.git` is unreliable in the OneDrive workspace, so commits have been made from `publish/`.

## 4. What Has Already Been Implemented

- Seven curriculum regions:
  - Citizenship Village
  - Modern Britain Borough
  - Rights & Law Quarter
  - Democracy Capital
  - Participation Harbour
  - Action Workshop
  - Exam Hall Castle
- NPC casts for every region.
- Three or more curriculum-linked quests per major NPC in the first village, and regional topic quests for later regions.
- Quest flow:
  - accept a quest from an NPC
  - travel to another NPC to collect evidence
  - return to the giver
  - answer a GCSE-style check question
  - earn coins/items/knowledge
- Travel gates:
  - all regional quests must be complete
  - the gate asks three questions
  - all three must be correct to unlock the next region
- RPG systems:
  - coins
  - inventory
  - outfits/tools/treasures/consumables
  - equip/use/sell actions
  - badges
  - automatic localStorage save/load
  - reset via `R` or `New Game`
- Accessibility/settings systems:
  - Settings overlay from HUD Controls
  - persistent Large text, High contrast, and Reduced motion toggles
  - reset-save control that keeps display settings
- Graphics/readability first pass:
  - visual style guide and region motif labels
  - asset-backed item thumbnails with CSS fallback
  - Apathy Shade story asset and subtle unresolved-region traces
  - hero visual presets shared by HUD portrait, Character panel, and canvas sprite
  - visible held-tool silhouettes for `Justice Quill` and `Debate Blade`
  - Backpack selected-item detail panel with category frames and quest-item lock markers
  - regional story title-card details with landmarks and key objects
  - themed mini-game visual layouts and visual medal/reward result blocks
- Mini-game and story systems:
  - mini-games are tied to regional NPCs and can be launched from NPC menus
  - Progress Center tracks story, quests, buildings, mini-games, curriculum, achievements, and choices against Apathy
  - Exam Simulation has multiple sections, section breakdown, and ending influence
- QA automation:
  - VM validation for world reachability and UI render/saved-state invariants
  - headless browser regression and visual smoke scripts
  - regional mini-game host playthrough, regional quest/gate playthrough, and local release smoke
- Controls:
  - WASD and arrow-key movement
  - `E` to talk/inspect
  - `1`, `2`, `3` to answer questions
- Developer travel menu for switching locations quickly during testing.
- Improved canvas rendering:
  - larger canvas
  - camera
  - layered drawing
  - more detailed player, NPCs, buildings, props
  - four-direction walking animation for the player
- NPC placement fix:
  - NPCs that were overlapping building collision tiles were moved to reachable nearby positions.
- NPC dialogue upgrade:
  - central square dialogue/modal window
  - unique inline SVG avatar inside every NPC interaction flow
  - faces are generated from NPC id, role, colour, and inferred gender
  - expression changes for talking, quest prompts, questions, wrong answers, rewards, and gates
- Curriculum content extraction:
  - `curriculum.js` now stores sections, topics, NPC prompts, and longer correct-answer explanations.

## 5. Current TODO List

- Resume after G2: graphics foundation, terrain tileset, and hero spritesheet first passes are complete, pushed, and deployed publicly for visual review. Next practical stage is G3 NPC recognisability + background life.
- Move NPCs/props/signposts in small regional passes to improve spawn -> landmark -> NPC cluster -> building/interior -> mini-game host -> travel gate readability.
- Re-run `node scripts\audit-map.js --write` and `node scripts\validate-world.js` after map data changes.
- Keep automated QA current when changing gameplay, UI, maps, save/load, or content.
- Run quick QA for focused UI changes and full QA before handoff/release candidates.
- Update `docs/VISUAL_STYLE_GUIDE.md`, `docs/GAMEPLAY_PROGRESS_LOG.md`, and `docs/GAMEPLAY_UPGRADE_PLAN.md` after each graphics subsection.
- Sync root changes into `publish/` after validated work, commit/push from `publish/`, deploy to Azure Static Web Apps production, and verify the live site after every completed game-development stage.
- Later backlog: move more hardcoded world/quest/NPC data out of `game.js`, improve curriculum coverage against the exact exam board specification, and verify the manual GitHub Actions deploy once the SWA token secret is configured.

## 6. Known Bugs or Failing Tests

- No blocking automated QA issues are known at this handoff. Focused local QA after §20.4 completed with `blockingIssues: 0` for UI regression and visual smoke.
- No blocking automated QA issues are known after the latest live deploy. Browser cache can still show stale deployed assets; use `Ctrl+F5` when checking the public site.
- `node --check game.js` and similar shell syntax checks can fail in this OneDrive/Codex sandbox with `EPERM` path access errors, even when the JS parses correctly. A workaround used successfully was reading file content through the Node REPL and running `new Function(source)`.
- The GitHub Actions deploy workflow is manual-only (`workflow_dispatch`) so normal pushes should not trigger failing deploy emails. The job id is `build_and_deploy_job`; manual workflow deploy still requires the GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.
- Root `.git` is not reliable in this workspace. Use `publish/` for Git operations unless the repository setup is repaired.
- Browser cache can show stale deployed assets; use `Ctrl+F5` when checking the public site.
- NPC avatars are procedural SVGs, not hand-painted or generated raster portraits. They are unique and role-aware but still visually simple.
- The dev travel menu is intentionally still visible for testing and should remain available during prototype work.

## 7. Commands to Build, Run, Lint and Test

There is no build step for normal development.

Run local static server from the project root:

```powershell
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
npx vite --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/index.html
```

Prepare a deploy folder:

```powershell
Copy-Item -Path index.html,styles.css,game.js,curriculum.js,staticwebapp.config.json -Destination dist -Force
```

Manual Azure Static Web Apps deploy:

```powershell
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
$token = az staticwebapp secrets list --name citizenship-gcse-game-nmilyaev --resource-group rg-citizenship-game --query properties.apiKey -o tsv
.\node_modules\.bin\swa.cmd deploy .\dist --deployment-token $token --env production
```

Git operations should generally be run in `publish/`:

```powershell
cd publish
git status --short
git add .
git commit -m "Describe the change"
git push origin main
```

No lint command currently exists.

Canonical QA commands are documented in `docs/QA_RUNBOOK.md`.

Quick QA used during the latest graphics passes:

```powershell
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
node --check game.js
node --check curriculum.js
node scripts\validate-world.js
node scripts\validate-ui.js
node qa-ui-regression.mjs
node qa-visual-smoke.mjs
```

Full local QA used before the §20.3 handoff:

```powershell
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
node --check game.js
node --check curriculum.js
node --check qa-ui-regression.mjs
node --check qa-visual-smoke.mjs
node --check qa-regional-playthrough.mjs
node --check qa-regional-quests-playthrough.mjs
node --check qa-release-smoke.mjs
node scripts\validate-world.js
node scripts\validate-ui.js
node qa-ui-regression.mjs
node qa-visual-smoke.mjs
node qa-regional-playthrough.mjs
node qa-regional-quests-playthrough.mjs
node qa-release-smoke.mjs
```

Useful ad hoc checks:

```powershell
Invoke-WebRequest -Uri https://lemon-meadow-063d62b03.7.azurestaticapps.net/game.js -UseBasicParsing
Invoke-WebRequest -Uri https://lemon-meadow-063d62b03.7.azurestaticapps.net/curriculum.js -UseBasicParsing
```

## 8. Environment Variables Needed

No runtime environment variables are needed by the web app itself.

Deployment needs Azure CLI authentication and a Static Web Apps deployment token. Do not commit secrets.

Expected GitHub Actions secret, if the manual workflow deployment is used:

```text
AZURE_STATIC_WEB_APPS_API_TOKEN
```

Known Azure deployment context:

```text
Azure Static Web App: citizenship-gcse-game-nmilyaev
Resource group: rg-citizenship-game
Tenant ID: 556b39ce-6176-482c-a969-cc36dd218dc8
Public URL: https://lemon-meadow-063d62b03.7.azurestaticapps.net
GitHub repo: NickyScout/citizenship-valley
```

Do not store or print the SWA deployment token.

## 9. Important Design Decisions

- Keep the app static and simple for now. The priority is fast iteration and easy Azure Static Web Apps hosting.
- Use `localStorage` for save/load because there is no backend yet.
- Keep the developer travel menu visible during prototyping to speed testing across regions.
- Use data-driven curriculum where possible. `curriculum.js` is the first step; more quest/world data should eventually move out of `game.js`.
- Use a central square NPC dialogue window for every interaction type so questions, quest text, travel gates, and feedback feel consistent.
- Use procedural SVG portraits now. This keeps each NPC visually distinct without managing many raster files, and mood changes are handled by drawing different mouths/brows/accessories.
- Preserve pixel-art feel in canvas rendering, while replacing the highest-value placeholders with small PNG/WebP assets under `assets/`.
- Keep travel gates gated by quest completion plus three correct answers, reinforcing mastery before progression.
- Avoid adding a framework until the static JS file becomes too difficult to maintain.
- Deployment is expected after each completed game-development stage for user visual testing. Do not print SWA deployment tokens; keep them in local variables only.

## 10. Next Recommended Task

Next follow-up:

1. Start G3 — NPC recognisability + background life.
2. After G3 implementation, run validation, sync `publish/`, commit/push, deploy to the public Azure Static Web Apps site, and verify live markers/assets for user visual testing.

Keep `scripts/qa-route-audit.js --write`, `node scripts\validate-world.js`, `node qa-visual-smoke.mjs`, and regional playthrough scripts in the release checklist after future map changes.
