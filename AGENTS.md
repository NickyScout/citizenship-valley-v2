# Agent instructions

## Project

Citizenship Valley is a static browser RPG prototype for UK GCSE Citizenship revision. It teaches curriculum topics through a top-down indie-style game with themed regions, NPC dialogue, investigation quests, travel gates, rewards, inventory, and local browser save/load.

The current priority is educational clarity and safe iteration. Gameplay systems should support learning GCSE Citizenship concepts without making the codebase harder to maintain.

## Tech stack

- Backend: none
- Frontend: plain HTML, CSS, and JavaScript
- Rendering: HTML canvas, custom 2D drawing code in `game.js`
- Data/content: `game.js` for runtime world data, `curriculum.js` for curriculum topic explanations
- Database: none
- Auth: none
- Save system: browser `localStorage`
- Deployment: Azure Static Web Apps
- Repository: `NickyScout/citizenship-valley-v2`

## Rules

- Do not introduce large architectural changes without explaining the trade-off.
- Keep changes small and reviewable.
- Prefer existing patterns in the repo.
- Never commit secrets, deployment tokens, Azure credentials, or local machine-specific private data.
- Update tests when changing behavior. If no tests exist for the changed area, add a focused check when practical or document the test gap.
- Run lint and tests before finishing when commands exist.
- Keep `Citizenship Village` behavior stable unless the task explicitly asks to change the first level.
- Preserve keyboard controls while adding mouse/touch/mobile controls.
- Do not remove the developer travel menu unless explicitly asked; it is used for testing regions.
- Treat `curriculum.js` as the preferred place for editable GCSE topic explanations.
- Avoid moving large blocks of world data out of `game.js` unless the task is specifically about data refactoring.
- For visual changes, check that NPCs, buildings, labels, dialogue windows, and touch controls do not overlap badly on desktop and mobile.
- For map/layout changes, verify player spawn points and NPC positions are not blocked by buildings, water, trees, or collision tiles.

## Commands

Install:

```powershell
npm install
```

Run:

```powershell
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
npx vite --host 127.0.0.1
```

Then open:

```text
http://127.0.0.1:5173/index.html
```

Test:

```powershell
# Quick checks:
$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
.\.tools\node-v22.11.0-win-x64\node.exe --check game.js
.\.tools\node-v22.11.0-win-x64\node.exe --check curriculum.js
node --check scripts\audit-map.js
node --check scripts\qa-route-audit.js
node scripts\audit-map.js --write
node scripts\qa-route-audit.js --write
node scripts\validate-world.js
node scripts\validate-ui.js
```

Full QA runbook: `docs/QA_RUNBOOK.md`

Lint:

```powershell
# No lint command exists yet.
```

Deploy:

```powershell
if (Test-Path dist) { Remove-Item -LiteralPath dist -Recurse -Force }
New-Item -ItemType Directory -Force -Path dist | Out-Null
Copy-Item -Path index.html,styles.css,game.js,curriculum.js,staticwebapp.config.json -Destination dist -Force
if (Test-Path assets) { Copy-Item -Path assets -Destination dist -Recurse -Force }
if (Test-Path dist\assets\characters\portraits-src) { Remove-Item -LiteralPath dist\assets\characters\portraits-src -Recurse -Force }
if (Test-Path dist\assets\tiles\tiles-src) { Remove-Item -LiteralPath dist\assets\tiles\tiles-src -Recurse -Force }

$env:PATH = "$PWD\.tools\node-v22.11.0-win-x64;$env:PATH"
$token = az staticwebapp secrets list --name citizenship-valley-v2 --resource-group rg-citizenship-game --query properties.apiKey -o tsv
.\node_modules\.bin\swa.cmd deploy .\dist --deployment-token $token --env production
```

Do not print or commit the deployment token.

## Definition of done

- Code compiles or static files load without console-breaking syntax errors.
- Tests pass, or the absence of tests is explicitly noted.
- Relevant docs are updated when behavior, commands, architecture, or curriculum structure changes.
- No secrets or local private paths are committed.
- Player can move from the initial spawn for every affected location.
- NPCs remain reachable after map/layout changes.
- Public site is redeployed when the user expects the change to be live. Current V2 working preference: after every completed change, commit to git AND deploy to the live Static Web App (bump the semantic `2.0.x` version first).
