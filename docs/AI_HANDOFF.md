# AI Handoff

## 0. V2 START — current state (2026-06-17)

> This section is the authoritative current state. **Everything below section 0 is historical (pre-2026-06-05) and partly outdated — read it for background only, and trust this section where they conflict.** V2's focus is a **new-graphics overhaul**; all V1 gameplay systems carry over as the foundation.

### V2 baseline
- Forked from V1 final (`2026.06.12.34`, V1 tag `v1.0` on the old repo). **Version reset to semantic `2.0.0`** — bump the patch (`2.0.1`, `2.0.2`, …) on each deploy.
- Live site (NEW V2 SWA): `https://black-grass-036ec2d03.7.azurestaticapps.net`, version **`2.0.0`**.
- Git: root **IS** a normal Git repo. Remote `NickyScout/citizenship-valley-v2`, branch `main`. Commit + `git push origin main` from the **root**. The legacy `publish/` mirror and its sync step are GONE — deploy builds `dist/` from root directly.
- Node: bundled at `.tools/node-v22.11.0-win-x64` (gitignored). Always prefix:
  `$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"` before node commands.
- **No `package.json` at root** — `node_modules/` (holds the `swa` CLI) is NOT reproducible via `npm install`; it must be carried over, not reinstalled.

### Deploy recipe (verified)
1. Bump the cache-bust version in `index.html` — **5 markers**: `styles.css?v=`, `<body data-app-version=`, `#appVersion` text `v…`, `curriculum.js?v=`, `game.js?v=`. Use the next semantic patch (`2.0.1`, …). Returning browsers won't refetch an identical `?v=`.
2. Build `dist/`: copy `index.html,styles.css,game.js,curriculum.js,staticwebapp.config.json` + `assets/` into `dist`, then delete `dist/assets/characters/portraits-src` (source atlases, excluded from deploy).
3. Token (never print/commit): `az staticwebapp secrets list --name citizenship-valley-v2 --resource-group rg-citizenship-game --query properties.apiKey -o tsv`.
4. `.\node_modules\.bin\swa.cmd deploy .\dist --deployment-token $token --env production`.
5. **Verify LIVE** flipped: fetch `index.html?cb=<ts>` for the new version + `game.js` for the changed line. Split bump/build/deploy/verify into separate commands (a giant `;`-chain can deploy a STALE dist).
- After deploy, `git push origin main` (separate from Azure). Verify sync `git rev-list --left-right --count origin/main...HEAD` == `0 0`. `dist/` and `*-result.json` are gitignored — never staged.

### QA (all pass at the V1 fork point)
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

### Carried-over notes
- The V2 SWA (`citizenship-valley-v2`, RG `rg-citizenship-game`, West Europe, Free) and the GitHub repo (`NickyScout/citizenship-valley-v2`) are LIVE; identifiers are repointed in `AGENTS.md`, `.github/copilot-instructions.md`, `README.md`, sections 7–8 below, and repo memory (`/memories/repo/`).
- Stale facts in the legacy sections below to ignore: "root is not a Git repo / use publish/", "procedural SVG portraits" (real PNGs now exist), the G2/G3 TODO list, `SAVE_VERSION = 6` (V1 reached `SAVE_VERSION = 7`; see `migrateSave()` for the real current target).
- The legacy `publish/` mirror was dropped before V2 started; ignore any "sync publish/" workflow mentions in the historical sections below.

---

## 0. Historical status (superseded)

The detailed V1 status narrative that used to live here (G0–G9 graphics generation, §20.x readability passes, Map Phases 1–5, per-stage notes) is consolidated in `docs/DEVELOPMENT_HISTORY.md`. Section 0 above is the authoritative current state.

## 1. Project Purpose

Citizenship Valley is a browser-based indie RPG prototype for helping a student revise UK GCSE Citizenship. The game presents the curriculum as a top-down RPG world with themed regions, NPC conversations, short investigation quests, rewards, and travel gates that test knowledge before the next region unlocks.

The current goal is educational first, game feel second: each quest should teach a GCSE Citizenship concept through NPC dialogue, then check understanding with a short multiple-choice question.

## 2. Current Architecture

This is a static HTML/CSS/JavaScript canvas game. There is no bundler, framework, TypeScript, or backend.

- `index.html` defines the canvas, HUD, dialogue containers, and script order.
- `styles.css` handles page layout, HUD, inventory UI, hero portraits, item category frames/detail panel, settings/accessibility modes, and the centered NPC dialogue window.
- `game.js` contains the game loop, canvas rendering, world data, NPCs, quests, movement, inventory, mini-games, story state, save/load, and UI event handling.
- `curriculum.js` defines the external curriculum guide and enriches quest explanations through `window.GCSE_CURRICULUM_INDEX`.
- Browser progress is saved in `localStorage` under `citizenshipValleySaveV1`; the current save version is `SAVE_VERSION = 7` (see `migrateSave()`). Browser display settings are saved separately under `citizenshipValleySettingsV1`.
- Azure Static Web Apps hosts the public static site. Current workflow expectation: after each completed implementation stage, validate locally, commit/push from the repository root, deploy to production SWA, and verify live markers/assets. Do not print deployment tokens. (The legacy `publish/` sync step was removed in V2.)

Rendering uses a `1280x768` canvas. The logical tile size is `32`, rendered at `1.5x` so visible tiles are `48px`. The camera follows the player. The draw pipeline is split into layers: ground, paths, buildings, props, characters, and world UI.

## 3. Main Folders and Important Files

- `index.html` - static shell, canvas, HUD, script includes.
- `styles.css` - visual styling for HUD, inventory, settings, central NPC dialogue, and responsive layout.
- `game.js` - main game implementation and most runtime data.
- `curriculum.js` - editable GCSE topic map grouped by location, with NPC prompts and longer correct-answer explanations.
- `CURRICULUM_MAP.md` - broader course/world planning notes.
- `README.md` - short project overview and play instructions.
- `docs/PROJECT_FEATURES.md` - consolidated description of current features and characteristics.
- `docs/DEVELOPMENT_HISTORY.md` - condensed build history, key decisions, art-direction principles, and the forward roadmap.
- `docs/DEVELOPMENT_PLAN.md` - active V2 staged development plan (terrain → hero → NPCs → buildings → UI → mini-games → learning → polish), with QA gates.
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
- `publish/` - REMOVED in V2. The legacy mirror is gone; Git runs from the repository root tracking `NickyScout/citizenship-valley-v2`. (Historical: V1 once used `publish/` because the root `.git` was unreliable in the OneDrive workspace.)

## 4. What has been implemented

See `docs/PROJECT_FEATURES.md` for the full, current feature list — world & content (7 regions, 45 quests, 5 exam rooms, travel gates), the core loop, RPG systems (customisation, stats, Exam Readiness, inventory/economy, achievements), the 11 mini-games, story & endings, learning systems, graphics & presentation, accessibility, controls, and QA tooling.

## 5. Current TODO List

- Resume after G2: graphics foundation, terrain tileset, and hero spritesheet first passes are complete, pushed, and deployed publicly for visual review. Next practical stage is G3 NPC recognisability + background life.
- Move NPCs/props/signposts in small regional passes to improve spawn -> landmark -> NPC cluster -> building/interior -> mini-game host -> travel gate readability.
- Re-run `node scripts\audit-map.js --write` and `node scripts\validate-world.js` after map data changes.
- Keep automated QA current when changing gameplay, UI, maps, save/load, or content.
- Run quick QA for focused UI changes and full QA before handoff/release candidates.
- Update `docs/VISUAL_STYLE_GUIDE.md`, `docs/PROJECT_FEATURES.md`, and `docs/DEVELOPMENT_HISTORY.md` after each graphics subsection.
- After validated work, commit/push from the repository root, deploy to Azure Static Web Apps production, and verify the live site after every completed game-development stage.
- Later backlog: move more hardcoded world/quest/NPC data out of `game.js`, improve curriculum coverage against the exact exam board specification, and verify the manual GitHub Actions deploy once the SWA token secret is configured.

## 6. Known bugs / notes

- Browser cache can show stale deployed assets; use `Ctrl+F5` when checking the public site.
- No blocking automated QA issues are known at the V1 fork point (UI regression and visual smoke report `blockingIssues: 0`).
- The GitHub Actions deploy workflow is manual-only (`workflow_dispatch`); the job id is `build_and_deploy_job` and it needs the repo secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. Normal pushes do not trigger it.
- The dev travel menu is intentionally visible for testing and should remain available during prototype work.

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
$token = az staticwebapp secrets list --name citizenship-valley-v2 --resource-group rg-citizenship-game --query properties.apiKey -o tsv
.\node_modules\.bin\swa.cmd deploy .\dist --deployment-token $token --env production
```

Git operations run from the repository ROOT (the legacy `publish/` mirror is gone):

```powershell
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
Invoke-WebRequest -Uri https://black-grass-036ec2d03.7.azurestaticapps.net/game.js -UseBasicParsing
Invoke-WebRequest -Uri https://black-grass-036ec2d03.7.azurestaticapps.net/curriculum.js -UseBasicParsing
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
Azure Static Web App: citizenship-valley-v2
Resource group: rg-citizenship-game
Region: West Europe (Free SKU)
Tenant ID: 556b39ce-6176-482c-a969-cc36dd218dc8
Subscription: Visual Studio Enterprise (67e06712-3740-4723-8d30-c290f1a160b8)
Public URL: https://black-grass-036ec2d03.7.azurestaticapps.net
GitHub repo: NickyScout/citizenship-valley-v2
```

Do not store or print the SWA deployment token.

## 9. Important Design Decisions

See `docs/DEVELOPMENT_HISTORY.md` → "Key design decisions" and "Hard-won lessons" for the full list (stay static/simple, education first, `curriculum.js` as source of truth, save compatibility via `migrateSave`, primitive fallback for every asset, reachability invariants, deploy only on explicit request).

## 10. Next Recommended Task

Continue the V2 new-graphics overhaul per the staged plan in `docs/DEVELOPMENT_PLAN.md` (play-field first: V2-1 terrain/greenery → V2-2 hero → V2-3 NPC art). Work in small, QA-gated steps; bump the semantic version (`2.0.x`) and deploy only on explicit request.

Keep `scripts/qa-route-audit.js --write`, `node scripts\validate-world.js`, `node qa-visual-smoke.mjs`, and regional playthrough scripts in the release checklist after future map changes.
