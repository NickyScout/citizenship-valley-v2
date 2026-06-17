# Release Smoke Checklist

Use this checklist before publishing a public build or handing off a release candidate.

## Automated Checks

Run the full QA suite from `docs/QA_RUNBOOK.md`:

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

Expected summary:

- `blockingIssues: 0` for browser scripts.
- World validation passes with 7 locations and 45 quests.
- UI validation passes with current save migration, 7 mini-games, and 19 achievements.
- Visual smoke creates 12 screenshots.
- Regional quest playthrough reaches `examHall` with 30 post-Village quests complete.
- Release smoke reports 7 region spot checks and local desktop/mobile smoke passed.

`qa-release-smoke.mjs` does not deploy. Deployment smoke remains a separate explicit step because it requires Azure authentication and a Static Web Apps token.

## Manual Desktop Smoke

- Hard refresh the local page.
- Start New Game.
- Move from Village spawn using keyboard controls.
- Talk to one NPC and open the quest menu.
- Open Backpack, Progress, Character, Mini-games, and Settings.
- Toggle Large text, High contrast, and Reduced motion, then reload and confirm the settings persist.
- Reset save from Settings and confirm the title screen returns.

## Manual Mobile Smoke

- Use browser device emulation around `390x844`.
- Confirm the canvas, HUD, touch controls, and Settings panel fit without horizontal overflow.
- Use touch movement and the `E` action button once.
- Open Inventory, Progress, Character, Mini-games, and Settings.

## Region Spot Check

- Use Dev Travel to visit each major region.
- Confirm the player spawn is visible and can move.
- Confirm one NPC can be opened in each region.
- Confirm mini-game hosts display a `Mini-game` button.

## Deployment Smoke

- Build/copy the deployment folder using the repository deploy instructions.
- Deploy without printing the Static Web Apps token.
- Hard refresh the public URL.
- Confirm the HUD version matches `index.html` cache-bust tokens.
- Open Settings and one Progress tab on the public site.